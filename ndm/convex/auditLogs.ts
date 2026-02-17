import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

// Internal mutation — called by admin actions, not exposed to clients
export const log = internalMutation({
  args: {
    adminId: v.string(),
    action: v.union(
      v.literal("submission_approved"),
      v.literal("submission_rejected"),
      v.literal("website_generated"),
      v.literal("website_deployed"),
      v.literal("payment_sent"),
      v.literal("submission_deleted"),
      v.literal("creator_updated"),
      v.literal("manual_override"),
    ),
    targetType: v.union(
      v.literal("submission"),
      v.literal("creator"),
      v.literal("website"),
      v.literal("withdrawal"),
    ),
    targetId: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLogs", {
      adminId: args.adminId,
      action: args.action,
      targetType: args.targetType,
      targetId: args.targetId,
      metadata: args.metadata,
      timestamp: Date.now(),
    });
  },
});

// Query audit logs for a specific target (e.g. a submission's full history)
export const getByTarget = query({
  args: {
    targetType: v.union(
      v.literal("submission"),
      v.literal("creator"),
      v.literal("website"),
      v.literal("withdrawal"),
    ),
    targetId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("auditLogs")
      .withIndex("by_target", (q) =>
        q.eq("targetType", args.targetType).eq("targetId", args.targetId)
      )
      .order("desc")
      .collect();
  },
});

// Query recent audit logs (admin dashboard)
export const getRecent = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    return await ctx.db
      .query("auditLogs")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);
  },
});

// Query audit logs by admin
export const getByAdmin = query({
  args: {
    adminId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    return await ctx.db
      .query("auditLogs")
      .withIndex("by_admin", (q) => q.eq("adminId", args.adminId))
      .order("desc")
      .take(limit);
  },
});
