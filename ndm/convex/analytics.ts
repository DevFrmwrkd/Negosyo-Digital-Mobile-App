import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

// === Creator Analytics ===

// Upsert a creator's analytics for a given period
export const upsertCreatorStats = internalMutation({
  args: {
    creatorId: v.id("creators"),
    period: v.string(),
    periodType: v.union(v.literal("daily"), v.literal("monthly")),
    stats: v.object({
      submissionsCount: v.optional(v.number()),
      approvedCount: v.optional(v.number()),
      rejectedCount: v.optional(v.number()),
      leadsGenerated: v.optional(v.number()),
      earningsTotal: v.optional(v.number()),
      websitesLive: v.optional(v.number()),
      referralsCount: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("analytics")
      .withIndex("by_creator_period", (q) =>
        q
          .eq("creatorId", args.creatorId)
          .eq("periodType", args.periodType)
          .eq("period", args.period)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args.stats,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("analytics", {
        creatorId: args.creatorId,
        period: args.period,
        periodType: args.periodType,
        submissionsCount: args.stats.submissionsCount ?? 0,
        approvedCount: args.stats.approvedCount ?? 0,
        rejectedCount: args.stats.rejectedCount ?? 0,
        leadsGenerated: args.stats.leadsGenerated ?? 0,
        earningsTotal: args.stats.earningsTotal ?? 0,
        websitesLive: args.stats.websitesLive ?? 0,
        referralsCount: args.stats.referralsCount ?? 0,
        updatedAt: Date.now(),
      });
    }
  },
});

// Increment a specific stat by a delta (for real-time event tracking)
export const incrementStat = internalMutation({
  args: {
    creatorId: v.id("creators"),
    period: v.string(),
    periodType: v.union(v.literal("daily"), v.literal("monthly")),
    field: v.union(
      v.literal("submissionsCount"),
      v.literal("approvedCount"),
      v.literal("rejectedCount"),
      v.literal("leadsGenerated"),
      v.literal("earningsTotal"),
      v.literal("websitesLive"),
      v.literal("referralsCount"),
    ),
    delta: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("analytics")
      .withIndex("by_creator_period", (q) =>
        q
          .eq("creatorId", args.creatorId)
          .eq("periodType", args.periodType)
          .eq("period", args.period)
      )
      .first();

    if (existing) {
      const currentValue = (existing as any)[args.field] || 0;
      await ctx.db.patch(existing._id, {
        [args.field]: currentValue + args.delta,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("analytics", {
        creatorId: args.creatorId,
        period: args.period,
        periodType: args.periodType,
        submissionsCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
        leadsGenerated: 0,
        earningsTotal: 0,
        websitesLive: 0,
        referralsCount: 0,
        [args.field]: args.delta,
        updatedAt: Date.now(),
      });
    }
  },
});

// Get creator analytics for a specific period range
export const getCreatorStats = query({
  args: {
    creatorId: v.id("creators"),
    periodType: v.union(v.literal("daily"), v.literal("monthly")),
    fromPeriod: v.optional(v.string()),
    toPeriod: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("analytics")
      .withIndex("by_creator_period", (q) =>
        q.eq("creatorId", args.creatorId).eq("periodType", args.periodType)
      );

    const results = await q.collect();

    // Filter by period range if provided
    let filtered = results;
    if (args.fromPeriod) {
      filtered = filtered.filter((r) => r.period >= args.fromPeriod!);
    }
    if (args.toPeriod) {
      filtered = filtered.filter((r) => r.period <= args.toPeriod!);
    }

    return filtered;
  },
});

// Get platform-wide stats for admin dashboard (aggregate all creators for a period)
export const getPlatformStats = query({
  args: {
    periodType: v.union(v.literal("daily"), v.literal("monthly")),
    period: v.string(),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("analytics")
      .withIndex("by_period", (q) =>
        q.eq("periodType", args.periodType).eq("period", args.period)
      )
      .collect();

    return results.reduce(
      (acc, row) => ({
        submissionsCount: acc.submissionsCount + row.submissionsCount,
        approvedCount: acc.approvedCount + row.approvedCount,
        rejectedCount: acc.rejectedCount + row.rejectedCount,
        leadsGenerated: acc.leadsGenerated + row.leadsGenerated,
        earningsTotal: acc.earningsTotal + row.earningsTotal,
        websitesLive: acc.websitesLive + row.websitesLive,
        referralsCount: acc.referralsCount + row.referralsCount,
        creatorsActive: acc.creatorsActive + 1,
      }),
      {
        submissionsCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
        leadsGenerated: 0,
        earningsTotal: 0,
        websitesLive: 0,
        referralsCount: 0,
        creatorsActive: 0,
      }
    );
  },
});

// === Website Analytics ===

// Upsert website analytics for a given date
export const upsertWebsiteStats = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    date: v.string(),
    stats: v.object({
      pageViews: v.optional(v.number()),
      uniqueVisitors: v.optional(v.number()),
      contactClicks: v.optional(v.number()),
      whatsappClicks: v.optional(v.number()),
      phoneClicks: v.optional(v.number()),
      formSubmissions: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("websiteAnalytics")
      .withIndex("by_submission_date", (q) =>
        q.eq("submissionId", args.submissionId).eq("date", args.date)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args.stats,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("websiteAnalytics", {
        submissionId: args.submissionId,
        date: args.date,
        pageViews: args.stats.pageViews ?? 0,
        uniqueVisitors: args.stats.uniqueVisitors ?? 0,
        contactClicks: args.stats.contactClicks ?? 0,
        whatsappClicks: args.stats.whatsappClicks ?? 0,
        phoneClicks: args.stats.phoneClicks ?? 0,
        formSubmissions: args.stats.formSubmissions ?? 0,
        updatedAt: Date.now(),
      });
    }
  },
});

// Get website analytics for a submission over a date range
export const getWebsiteStats = query({
  args: {
    submissionId: v.id("submissions"),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("websiteAnalytics")
      .withIndex("by_submission_date", (q) =>
        q.eq("submissionId", args.submissionId)
      )
      .collect();

    let filtered = results;
    if (args.fromDate) {
      filtered = filtered.filter((r) => r.date >= args.fromDate!);
    }
    if (args.toDate) {
      filtered = filtered.filter((r) => r.date <= args.toDate!);
    }

    // Also compute totals
    const totals = filtered.reduce(
      (acc, row) => ({
        pageViews: acc.pageViews + row.pageViews,
        uniqueVisitors: acc.uniqueVisitors + row.uniqueVisitors,
        contactClicks: acc.contactClicks + row.contactClicks,
        whatsappClicks: acc.whatsappClicks + row.whatsappClicks,
        phoneClicks: acc.phoneClicks + row.phoneClicks,
        formSubmissions: acc.formSubmissions + row.formSubmissions,
      }),
      {
        pageViews: 0,
        uniqueVisitors: 0,
        contactClicks: 0,
        whatsappClicks: 0,
        phoneClicks: 0,
        formSubmissions: 0,
      }
    );

    return { daily: filtered, totals };
  },
});

// Get all website analytics for a specific date (admin view)
export const getWebsiteStatsByDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("websiteAnalytics")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
  },
});

// === Helpers ===

// Get today's date string in YYYY-MM-DD format
export function getTodayString(): string {
  const now = new Date();
  return now.toISOString().split("T")[0];
}

// Get current month string in YYYY-MM format
export function getCurrentMonthString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
