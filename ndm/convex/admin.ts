import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const approveSubmission = mutation({
  args: {
    id: v.id("submissions"),
    adminId: v.string(),
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.id);
    if (!submission) throw new Error("Submission not found");

    await ctx.db.patch(args.id, {
      status: "approved",
    });

    // Audit log
    await ctx.scheduler.runAfter(0, internal.auditLogs.log, {
      adminId: args.adminId,
      action: "submission_approved",
      targetType: "submission",
      targetId: args.id,
      metadata: { businessName: submission.businessName, previousStatus: submission.status },
    });

    // Notify creator
    await ctx.scheduler.runAfter(0, internal.notifications.createAndSend, {
      creatorId: submission.creatorId,
      type: "submission_approved",
      title: "Submission Approved!",
      body: `Your submission for "${submission.businessName}" has been approved.`,
      data: { submissionId: args.id },
    });

    // Check if this creator was referred — qualify referral on first approved submission
    const otherApproved = await ctx.db
      .query("submissions")
      .withIndex("by_creator_status", (q) =>
        q.eq("creatorId", submission.creatorId).eq("status", "approved")
      )
      .first();

    // If this is the first approved submission (only the one we just approved)
    if (!otherApproved || otherApproved._id === args.id) {
      const referral = await ctx.db
        .query("referrals")
        .withIndex("by_referred", (q) => q.eq("referredId", submission.creatorId))
        .first();

      if (referral && referral.status === "pending") {
        await ctx.scheduler.runAfter(0, internal.referrals.qualifyByCreator, {
          referredCreatorId: submission.creatorId,
          submissionId: args.id,
          bonusAmount: 100, // ₱100 referral bonus — configurable later
        });
      }
    }
  },
});

export const rejectSubmission = mutation({
  args: {
    id: v.id("submissions"),
    reason: v.optional(v.string()),
    adminId: v.string(),
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.id);
    if (!submission) throw new Error("Submission not found");

    await ctx.db.patch(args.id, {
      status: "rejected",
      rejectionReason: args.reason,
    });

    // Audit log
    await ctx.scheduler.runAfter(0, internal.auditLogs.log, {
      adminId: args.adminId,
      action: "submission_rejected",
      targetType: "submission",
      targetId: args.id,
      metadata: { businessName: submission.businessName, reason: args.reason, previousStatus: submission.status },
    });

    // Notify creator
    await ctx.scheduler.runAfter(0, internal.notifications.createAndSend, {
      creatorId: submission.creatorId,
      type: "submission_rejected",
      title: "Submission Needs Changes",
      body: args.reason
        ? `Your submission for "${submission.businessName}" needs changes: ${args.reason}`
        : `Your submission for "${submission.businessName}" needs some changes.`,
      data: { submissionId: args.id, reason: args.reason },
    });
  },
});

export const markWebsiteGenerated = mutation({
  args: {
    id: v.id("submissions"),
    websiteUrl: v.string(),
    adminId: v.string(),
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.id);
    if (!submission) throw new Error("Submission not found");

    await ctx.db.patch(args.id, {
      status: "website_generated",
      websiteUrl: args.websiteUrl,
    });

    // Audit log
    await ctx.scheduler.runAfter(0, internal.auditLogs.log, {
      adminId: args.adminId,
      action: "website_generated",
      targetType: "submission",
      targetId: args.id,
      metadata: { businessName: submission.businessName, websiteUrl: args.websiteUrl },
    });
  },
});

export const markDeployed = mutation({
  args: {
    id: v.id("submissions"),
    websiteUrl: v.string(),
    adminId: v.string(),
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.id);
    if (!submission) throw new Error("Submission not found");

    await ctx.db.patch(args.id, {
      status: "deployed",
      websiteUrl: args.websiteUrl,
    });

    // Audit log
    await ctx.scheduler.runAfter(0, internal.auditLogs.log, {
      adminId: args.adminId,
      action: "website_deployed",
      targetType: "submission",
      targetId: args.id,
      metadata: { businessName: submission.businessName, websiteUrl: args.websiteUrl },
    });

    // Notify creator that website is live
    await ctx.scheduler.runAfter(0, internal.notifications.createAndSend, {
      creatorId: submission.creatorId,
      type: "website_live",
      title: "Website is Live!",
      body: `The website for "${submission.businessName}" is now live and ready to receive leads.`,
      data: { submissionId: args.id, websiteUrl: args.websiteUrl },
    });
  },
});

export const markPaid = mutation({
  args: {
    id: v.id("submissions"),
    adminId: v.string(),
  },
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

    // Audit log
    await ctx.scheduler.runAfter(0, internal.auditLogs.log, {
      adminId: args.adminId,
      action: "payment_sent",
      targetType: "submission",
      targetId: args.id,
      metadata: {
        businessName: submission.businessName,
        amount: submission.creatorPayout,
        creatorId: submission.creatorId,
      },
    });

    // Notify creator about payout
    await ctx.scheduler.runAfter(0, internal.notifications.createAndSend, {
      creatorId: submission.creatorId,
      type: "payout_sent",
      title: "Payment Sent!",
      body: submission.creatorPayout
        ? `You earned ₱${submission.creatorPayout.toLocaleString()} for "${submission.businessName}".`
        : `Payment processed for "${submission.businessName}".`,
      data: { submissionId: args.id, amount: submission.creatorPayout },
    });
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
