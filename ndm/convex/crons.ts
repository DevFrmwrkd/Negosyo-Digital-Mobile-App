import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run daily aggregation at midnight (UTC) — rolls up daily stats into monthly
crons.daily(
  "aggregate monthly stats",
  { hourUTC: 0, minuteUTC: 0 },
  internal.analyticsJobs.aggregateDailyToMonthly,
);

export default crons;
