import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const approveSubmission = mutation({
  args: { id: v.id("submissions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "approved",
    });
  },
});

export const rejectSubmission = mutation({
  args: {
    id: v.id("submissions"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "rejected",
      rejectionReason: args.reason,
    });
  },
});

export const markWebsiteGenerated = mutation({
  args: {
    id: v.id("submissions"),
    websiteUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "website_generated",
      websiteUrl: args.websiteUrl,
    });
  },
});

export const markDeployed = mutation({
  args: {
    id: v.id("submissions"),
    websiteUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "deployed",
      websiteUrl: args.websiteUrl,
    });
  },
});

export const markPaid = mutation({
  args: { id: v.id("submissions") },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.id);
    if (!submission) {
      throw new Error("Submission not found");
    }

    // Update submission status
    await ctx.db.patch(args.id, {
      status: "paid",
    });

    // Add payout to creator's balance
    if (submission.creatorPayout) {
      const creator = await ctx.db.get(submission.creatorId);
      if (creator) {
        await ctx.db.patch(submission.creatorId, {
          balance: (creator.balance || 0) + submission.creatorPayout,
        });
      }
    }
  },
});

export const getAllSubmissionsWithCreators = query({
  args: {},
  handler: async (ctx) => {
    const submissions = await ctx.db.query("submissions").order("desc").collect();

    const submissionsWithCreators = await Promise.all(
      submissions.map(async (submission) => {
        const creator = await ctx.db.get(submission.creatorId);
        return { ...submission, creator };
      })
    );

    return submissionsWithCreators;
  },
});
