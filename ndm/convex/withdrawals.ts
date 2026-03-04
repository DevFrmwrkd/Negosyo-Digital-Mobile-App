import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ---------------------------------------------------------------------------
// Public mutations
// ---------------------------------------------------------------------------

/**
 * Request a withdrawal via Wise bank transfer.
 * Deducts the balance immediately (optimistic) and schedules the Wise transfer.
 */
export const create = mutation({
  args: {
    creatorId: v.id("creators"),
    amount: v.number(),
    accountHolderName: v.string(),
    bankName: v.string(),
    bankCode: v.string(),
    accountNumber: v.string(),
    city: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.amount < 100) {
      throw new Error("Minimum withdrawal amount is ₱100");
    }

    const creator = await ctx.db.get(args.creatorId);
    if (!creator) throw new Error("Creator not found");

    const currentBalance = creator.balance ?? 0;
    if (args.amount > currentBalance) {
      throw new Error("Insufficient balance");
    }

    // Deduct balance immediately (optimistic)
    await ctx.db.patch(args.creatorId, {
      balance: currentBalance - args.amount,
    });

    const accountDetails = `${args.accountHolderName} — ${args.bankName} ${args.accountNumber}`;

    const withdrawalId = await ctx.db.insert("withdrawals", {
      creatorId: args.creatorId,
      amount: args.amount,
      payoutMethod: "bank_transfer",
      accountDetails,
      accountHolderName: args.accountHolderName,
      bankName: args.bankName,
      bankCode: args.bankCode,
      accountNumber: args.accountNumber,
      status: "pending",
      createdAt: Date.now(),
    });

    // Schedule Wise transfer — runs asynchronously after this mutation
    await ctx.scheduler.runAfter(0, internal.wise.initiateTransfer, {
      withdrawalId,
      accountHolderName: args.accountHolderName,
      accountNumber: args.accountNumber,
      bankCode: args.bankCode,
      city: args.city,
      amountPHP: args.amount,
    });

    return withdrawalId;
  },
});

/**
 * Admin: manually update withdrawal status (for overrides and manual processing).
 */
export const updateStatus = mutation({
  args: {
    id: v.id("withdrawals"),
    status: v.union(
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    transactionRef: v.optional(v.string()),
    adminId: v.string(),
  },
  handler: async (ctx, args) => {
    const withdrawal = await ctx.db.get(args.id);
    if (!withdrawal) throw new Error("Withdrawal not found");

    const updates: Record<string, unknown> = { status: args.status };

    if (args.status === "completed" || args.status === "failed") {
      updates.processedAt = Date.now();
    }
    if (args.transactionRef) {
      updates.transactionRef = args.transactionRef;
    }

    await ctx.db.patch(args.id, updates);

    if (args.status === "failed") {
      const creator = await ctx.db.get(withdrawal.creatorId);
      if (creator) {
        await ctx.db.patch(withdrawal.creatorId, {
          balance: (creator.balance ?? 0) + withdrawal.amount,
        });
      }
    }

    if (args.status === "completed") {
      const creator = await ctx.db.get(withdrawal.creatorId);
      if (creator) {
        await ctx.db.patch(withdrawal.creatorId, {
          totalWithdrawn: (creator.totalWithdrawn ?? 0) + withdrawal.amount,
        });
      }

      await ctx.scheduler.runAfter(0, internal.notifications.createAndSend, {
        creatorId: withdrawal.creatorId,
        type: "payout_sent",
        title: "Withdrawal Completed!",
        body: `Your withdrawal of ₱${withdrawal.amount.toLocaleString()} via Bank Transfer has been processed.`,
        data: { withdrawalId: args.id, amount: withdrawal.amount },
      });
    }

    await ctx.scheduler.runAfter(0, internal.auditLogs.log, {
      adminId: args.adminId,
      action: "payment_sent",
      targetType: "withdrawal",
      targetId: args.id,
      metadata: {
        status: args.status,
        amount: withdrawal.amount,
        payoutMethod: withdrawal.payoutMethod,
        creatorId: withdrawal.creatorId,
        transactionRef: args.transactionRef,
      },
    });
  },
});

// ---------------------------------------------------------------------------
// Internal mutations (called by Wise action / webhook)
// ---------------------------------------------------------------------------

/**
 * Store Wise transfer and recipient IDs after successful initiation.
 * Sets status to "processing".
 */
export const setWiseTransferIds = internalMutation({
  args: {
    withdrawalId: v.id("withdrawals"),
    wiseTransferId: v.string(),
    wiseRecipientId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.withdrawalId, {
      wiseTransferId: args.wiseTransferId,
      wiseRecipientId: args.wiseRecipientId,
      transactionRef: args.wiseTransferId,
      status: "processing",
    });
  },
});

/**
 * Mark a withdrawal as failed and restore the creator's balance.
 * Called by the Wise action on API errors.
 */
export const markFailed = internalMutation({
  args: {
    withdrawalId: v.id("withdrawals"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const withdrawal = await ctx.db.get(args.withdrawalId);
    if (!withdrawal) return;

    await ctx.db.patch(args.withdrawalId, {
      status: "failed",
      processedAt: Date.now(),
      failureReason: args.reason,
    });

    // Restore creator balance
    const creator = await ctx.db.get(withdrawal.creatorId);
    if (creator) {
      await ctx.db.patch(withdrawal.creatorId, {
        balance: (creator.balance ?? 0) + withdrawal.amount,
      });
    }
  },
});

/**
 * Called by the Wise webhook to update a withdrawal by its Wise transfer ID.
 */
export const updateByTransactionRef = internalMutation({
  args: {
    transactionRef: v.string(),
    status: v.union(
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("withdrawals").collect();
    const withdrawal = all.find((w) => w.transactionRef === args.transactionRef);

    if (!withdrawal) {
      console.error(`[Wise] No withdrawal found for transactionRef: ${args.transactionRef}`);
      return;
    }

    const updates: Record<string, unknown> = { status: args.status };
    if (args.status === "completed" || args.status === "failed") {
      updates.processedAt = Date.now();
    }

    await ctx.db.patch(withdrawal._id, updates);

    if (args.status === "failed") {
      const creator = await ctx.db.get(withdrawal.creatorId);
      if (creator) {
        await ctx.db.patch(withdrawal.creatorId, {
          balance: (creator.balance ?? 0) + withdrawal.amount,
        });
      }
    }

    if (args.status === "completed") {
      const creator = await ctx.db.get(withdrawal.creatorId);
      if (creator) {
        await ctx.db.patch(withdrawal.creatorId, {
          totalWithdrawn: (creator.totalWithdrawn ?? 0) + withdrawal.amount,
        });
      }

      await ctx.scheduler.runAfter(0, internal.notifications.createAndSend, {
        creatorId: withdrawal.creatorId,
        type: "payout_sent",
        title: "Withdrawal Completed!",
        body: `Your withdrawal of ₱${withdrawal.amount.toLocaleString()} has been processed.`,
        data: { withdrawalId: withdrawal._id, amount: withdrawal.amount },
      });
    }
  },
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getByCreator = query({
  args: { creatorId: v.id("creators") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("withdrawals")
      .withIndex("by_creator", (q) => q.eq("creatorId", args.creatorId))
      .order("desc")
      .collect();
  },
});

export const getByStatus = query({
  args: { status: v.string() },
  handler: async (ctx, args) => {
    const withdrawals = await ctx.db
      .query("withdrawals")
      .withIndex("by_status", (q) => q.eq("status", args.status as any))
      .order("desc")
      .collect();

    const enriched = await Promise.all(
      withdrawals.map(async (w) => {
        const creator = await ctx.db.get(w.creatorId);
        return {
          ...w,
          creatorName: creator
            ? `${creator.firstName ?? ""} ${creator.lastName ?? ""}`.trim()
            : "Unknown",
          creatorEmail: creator?.email,
        };
      })
    );

    return enriched;
  },
});

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const withdrawals = await ctx.db.query("withdrawals").order("desc").collect();

    const enriched = await Promise.all(
      withdrawals.map(async (w) => {
        const creator = await ctx.db.get(w.creatorId);
        return {
          ...w,
          creatorName: creator
            ? `${creator.firstName ?? ""} ${creator.lastName ?? ""}`.trim()
            : "Unknown",
        };
      })
    );

    return enriched;
  },
});
