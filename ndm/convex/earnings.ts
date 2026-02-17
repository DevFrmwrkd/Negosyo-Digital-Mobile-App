import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Create an earning record (internal — called by admin.markPaid, referrals.qualifyByCreator)
export const create = internalMutation({
  args: {
    creatorId: v.id("creators"),
    submissionId: v.id("submissions"),
    amount: v.number(),
    type: v.union(
      v.literal("submission_approved"),
      v.literal("referral_bonus"),
      v.literal("lead_bonus"),
    ),
    status: v.optional(
      v.union(v.literal("pending"), v.literal("available"), v.literal("withdrawn"))
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("earnings", {
      creatorId: args.creatorId,
      submissionId: args.submissionId,
      amount: args.amount,
      type: args.type,
      status: args.status ?? "available",
      createdAt: Date.now(),
    });
  },
});

// Get all earnings for a creator (transaction history)
export const getByCreator = query({
  args: { creatorId: v.id("creators") },
  handler: async (ctx, args) => {
    const earnings = await ctx.db
      .query("earnings")
      .withIndex("by_creator", (q) => q.eq("creatorId", args.creatorId))
      .order("desc")
      .collect();

    // Enrich with submission business names
    const enriched = await Promise.all(
      earnings.map(async (earning) => {
        const submission = await ctx.db.get(earning.submissionId);
        return {
          ...earning,
          businessName: submission?.businessName,
        };
      })
    );

    return enriched;
  },
});

// Get earnings for a specific submission
export const getBySubmission = query({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("earnings")
      .withIndex("by_submission", (q) => q.eq("submissionId", args.submissionId))
      .collect();
  },
});

// Get earnings summary for a creator
export const getSummary = query({
  args: { creatorId: v.id("creators") },
  handler: async (ctx, args) => {
    const earnings = await ctx.db
      .query("earnings")
      .withIndex("by_creator", (q) => q.eq("creatorId", args.creatorId))
      .collect();

    return {
      total: earnings.reduce((sum, e) => sum + e.amount, 0),
      available: earnings
        .filter((e) => e.status === "available")
        .reduce((sum, e) => sum + e.amount, 0),
      pending: earnings
        .filter((e) => e.status === "pending")
        .reduce((sum, e) => sum + e.amount, 0),
      withdrawn: earnings
        .filter((e) => e.status === "withdrawn")
        .reduce((sum, e) => sum + e.amount, 0),
      byType: {
        submissions: earnings
          .filter((e) => e.type === "submission_approved")
          .reduce((sum, e) => sum + e.amount, 0),
        referrals: earnings
          .filter((e) => e.type === "referral_bonus")
          .reduce((sum, e) => sum + e.amount, 0),
        leads: earnings
          .filter((e) => e.type === "lead_bonus")
          .reduce((sum, e) => sum + e.amount, 0),
      },
      count: earnings.length,
    };
  },
});

// Mark earnings as withdrawn (internal — called by withdrawals flow)
export const markWithdrawn = internalMutation({
  args: {
    earningIds: v.array(v.id("earnings")),
  },
  handler: async (ctx, args) => {
    for (const id of args.earningIds) {
      await ctx.db.patch(id, { status: "withdrawn" });
    }
  },
});
