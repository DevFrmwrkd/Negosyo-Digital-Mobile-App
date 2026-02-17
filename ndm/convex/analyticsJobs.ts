import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// Aggregate yesterday's daily stats into the current month's monthly record
export const aggregateDailyToMonthly = internalAction({
  args: {},
  handler: async (ctx) => {
    // Get yesterday's date (the cron runs at midnight, so we aggregate the previous day)
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0]; // "YYYY-MM-DD"
    const monthStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}`; // "YYYY-MM"

    console.log(`[Analytics Cron] Aggregating daily stats for ${yesterdayStr} into month ${monthStr}`);

    // Get all daily analytics records for yesterday
    const dailyRecords = await ctx.runQuery(internal.analyticsJobs.getDailyRecords, {
      period: yesterdayStr,
    });

    if (dailyRecords.length === 0) {
      console.log("[Analytics Cron] No daily records found for yesterday. Skipping.");
      return;
    }

    console.log(`[Analytics Cron] Found ${dailyRecords.length} creator records to aggregate`);

    // For each creator's daily record, upsert into their monthly record
    for (const record of dailyRecords) {
      await ctx.runMutation(internal.analytics.upsertCreatorStats, {
        creatorId: record.creatorId,
        period: monthStr,
        periodType: "monthly",
        stats: {
          submissionsCount: record.submissionsCount,
          approvedCount: record.approvedCount,
          rejectedCount: record.rejectedCount,
          leadsGenerated: record.leadsGenerated,
          earningsTotal: record.earningsTotal,
          websitesLive: record.websitesLive,
          referralsCount: record.referralsCount,
        },
      });
    }

    console.log(`[Analytics Cron] Aggregation complete for ${yesterdayStr}`);
  },
});

// Internal query to get daily records for a specific date
import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const getDailyRecords = internalQuery({
  args: { period: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("analytics")
      .withIndex("by_period", (q) =>
        q.eq("periodType", "daily").eq("period", args.period)
      )
      .collect();
  },
});
