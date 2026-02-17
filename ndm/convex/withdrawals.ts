import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Request a withdrawal
export const create = mutation({
  args: {
    creatorId: v.id("creators"),
    amount: v.number(),
    payoutMethod: v.union(v.literal("gcash"), v.literal("maya"), v.literal("bank_transfer")),
    accountDetails: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate minimum withdrawal
    if (args.amount < 100) {
      throw new Error("Minimum withdrawal amount is ₱100");
    }

    // Validate balance
    const creator = await ctx.db.get(args.creatorId);
    if (!creator) throw new Error("Creator not found");

    const currentBalance = creator.balance || 0;
    if (args.amount > currentBalance) {
      throw new Error("Insufficient balance");
    }

    // Deduct balance immediately (optimistic)
    await ctx.db.patch(args.creatorId, {
      balance: currentBalance - args.amount,
    });

    // Create withdrawal record
    const withdrawalId = await ctx.db.insert("withdrawals", {
      creatorId: args.creatorId,
      amount: args.amount,
      payoutMethod: args.payoutMethod,
      accountDetails: args.accountDetails,
      status: "pending",
      createdAt: Date.now(),
    });

    return withdrawalId;
  },
});

// Admin: update withdrawal status
export const updateStatus = mutation({
  args: {
    id: v.id("withdrawals"),
    status: v.union(
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    transactionRef: v.optional(v.string()),
    adminId: v.string(),
  },
  handler: async (ctx, args) => {
    const withdrawal = await ctx.db.get(args.id);
    if (!withdrawal) throw new Error("Withdrawal not found");

    const updates: Record<string, any> = {
      status: args.status,
    };

    if (args.status === "completed" || args.status === "failed") {
      updates.processedAt = Date.now();
    }

    if (args.transactionRef) {
      updates.transactionRef = args.transactionRef;
    }

    await ctx.db.patch(args.id, updates);

    // If failed, restore the creator's balance
    if (args.status === "failed") {
      const creator = await ctx.db.get(withdrawal.creatorId);
      if (creator) {
        await ctx.db.patch(withdrawal.creatorId, {
          balance: (creator.balance || 0) + withdrawal.amount,
        });
      }
    }

    // If completed, update totalWithdrawn
    if (args.status === "completed") {
      const creator = await ctx.db.get(withdrawal.creatorId);
      if (creator) {
        await ctx.db.patch(withdrawal.creatorId, {
          totalWithdrawn: (creator.totalWithdrawn || 0) + withdrawal.amount,
        });
      }

      // Notify creator
      await ctx.scheduler.runAfter(0, internal.notifications.createAndSend, {
        creatorId: withdrawal.creatorId,
        type: "payout_sent",
        title: "Withdrawal Completed!",
        body: `Your withdrawal of ₱${withdrawal.amount.toLocaleString()} via ${withdrawal.payoutMethod.toUpperCase()} has been processed.`,
        data: { withdrawalId: args.id, amount: withdrawal.amount },
      });
    }

    // Audit log
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

// Get withdrawals for a creator
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

// Admin: Get withdrawals by status (for admin queue)
export const getByStatus = query({
  args: { status: v.string() },
  handler: async (ctx, args) => {
    const withdrawals = await ctx.db
      .query("withdrawals")
      .withIndex("by_status", (q) => q.eq("status", args.status as any))
      .order("desc")
      .collect();

    // Enrich with creator info
    const enriched = await Promise.all(
      withdrawals.map(async (w) => {
        const creator = await ctx.db.get(w.creatorId);
        return {
          ...w,
          creatorName: creator
            ? `${creator.firstName || ""} ${creator.lastName || ""}`.trim()
            : "Unknown",
          creatorEmail: creator?.email,
        };
      })
    );

    return enriched;
  },
});

// Get all withdrawals (admin overview)
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
            ? `${creator.firstName || ""} ${creator.lastName || ""}`.trim()
            : "Unknown",
        };
      })
    );

    return enriched;
  },
});
