import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Called internally when a new creator signs up with a referral code
export const createFromSignup = internalMutation({
  args: {
    referrerId: v.id("creators"),
    referredId: v.id("creators"),
    referralCode: v.string(),
  },
  handler: async (ctx, args) => {
    // Check for duplicate referral (same referred user)
    const existing = await ctx.db
      .query("referrals")
      .withIndex("by_referred", (q) => q.eq("referredId", args.referredId))
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("referrals", {
      referrerId: args.referrerId,
      referredId: args.referredId,
      referralCode: args.referralCode,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

// Called when a referred creator's first submission is approved
// This qualifies the referral and creates an earning for the referrer
export const qualifyByCreator = internalMutation({
  args: {
    referredCreatorId: v.id("creators"),
    submissionId: v.id("submissions"),
    bonusAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const referral = await ctx.db
      .query("referrals")
      .withIndex("by_referred", (q) => q.eq("referredId", args.referredCreatorId))
      .first();

    if (!referral || referral.status !== "pending") return null;

    // Mark referral as qualified
    await ctx.db.patch(referral._id, {
      status: "qualified",
      bonusAmount: args.bonusAmount,
      qualifiedAt: Date.now(),
    });

    // Create earning record for the referrer
    await ctx.db.insert("earnings", {
      creatorId: referral.referrerId,
      submissionId: args.submissionId,
      amount: args.bonusAmount,
      type: "referral_bonus",
      status: "available",
      createdAt: Date.now(),
    });

    // Update referrer's balance
    const referrer = await ctx.db.get(referral.referrerId);
    if (referrer) {
      await ctx.db.patch(referral.referrerId, {
        balance: (referrer.balance || 0) + args.bonusAmount,
        totalEarnings: (referrer.totalEarnings || 0) + args.bonusAmount,
      });
    }

    // Notify the referrer
    await ctx.scheduler.runAfter(0, internal.notifications.createAndSend, {
      creatorId: referral.referrerId,
      type: "payout_sent",
      title: "Referral Bonus Earned!",
      body: `You earned ₱${args.bonusAmount.toLocaleString()} from a referral bonus! Your referred creator's submission was approved.`,
      data: { referralId: referral._id, amount: args.bonusAmount },
    });

    return referral._id;
  },
});

// Get all referrals made by a creator (people they referred)
export const getByReferrer = query({
  args: { referrerId: v.id("creators") },
  handler: async (ctx, args) => {
    const referrals = await ctx.db
      .query("referrals")
      .withIndex("by_referrer", (q) => q.eq("referrerId", args.referrerId))
      .order("desc")
      .collect();

    // Enrich with referred creator info
    return await Promise.all(
      referrals.map(async (ref) => {
        const referred = await ctx.db.get(ref.referredId);
        return {
          ...ref,
          referredName: referred
            ? `${referred.firstName || ""} ${referred.lastName || ""}`.trim() || referred.email
            : "Unknown",
        };
      })
    );
  },
});

// Get referral stats for a creator's dashboard
export const getStats = query({
  args: { referrerId: v.id("creators") },
  handler: async (ctx, args) => {
    const referrals = await ctx.db
      .query("referrals")
      .withIndex("by_referrer", (q) => q.eq("referrerId", args.referrerId))
      .collect();

    return {
      total: referrals.length,
      pending: referrals.filter((r) => r.status === "pending").length,
      qualified: referrals.filter((r) => r.status === "qualified").length,
      paid: referrals.filter((r) => r.status === "paid").length,
      totalEarned: referrals.reduce((sum, r) => sum + (r.bonusAmount || 0), 0),
    };
  },
});
