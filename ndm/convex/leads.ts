import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getTodayString, getCurrentMonthString } from "./analytics";

// Create a new lead (called by website contact form API)
export const create = mutation({
  args: {
    submissionId: v.id("submissions"),
    creatorId: v.id("creators"),
    source: v.union(v.literal("website"), v.literal("qr_code"), v.literal("direct")),
    name: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const leadId = await ctx.db.insert("leads", {
      ...args,
      status: "new",
      createdAt: Date.now(),
    });

    // Analytics — increment leadsGenerated
    const today = getTodayString();
    const month = getCurrentMonthString();
    await ctx.scheduler.runAfter(0, internal.analytics.incrementStat, {
      creatorId: args.creatorId,
      period: today,
      periodType: "daily",
      field: "leadsGenerated",
      delta: 1,
    });
    await ctx.scheduler.runAfter(0, internal.analytics.incrementStat, {
      creatorId: args.creatorId,
      period: month,
      periodType: "monthly",
      field: "leadsGenerated",
      delta: 1,
    });

    // Notify creator about new lead
    const submission = await ctx.db.get(args.submissionId);
    await ctx.scheduler.runAfter(0, internal.notifications.createAndSend, {
      creatorId: args.creatorId,
      type: "new_lead",
      title: "New Lead!",
      body: `${args.name} inquired about "${submission?.businessName || "your business"}".`,
      data: { submissionId: args.submissionId, leadId },
    });

    return leadId;
  },
});

// Update lead status (move through pipeline)
export const updateStatus = mutation({
  args: {
    id: v.id("leads"),
    status: v.union(
      v.literal("new"),
      v.literal("contacted"),
      v.literal("qualified"),
      v.literal("converted"),
      v.literal("lost"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
  },
});

// Get all leads for a specific business website
export const getBySubmission = query({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("leads")
      .withIndex("by_submission", (q) => q.eq("submissionId", args.submissionId))
      .order("desc")
      .collect();
  },
});

// Get all leads across all of a creator's businesses
export const getByCreator = query({
  args: { creatorId: v.id("creators") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("leads")
      .withIndex("by_creator", (q) => q.eq("creatorId", args.creatorId))
      .order("desc")
      .collect();
  },
});

// Get leads filtered by status
export const getByStatus = query({
  args: { status: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("leads")
      .withIndex("by_status", (q) => q.eq("status", args.status as any))
      .order("desc")
      .collect();
  },
});

// Get lead count by submission (for dashboard widgets)
export const getCountBySubmission = query({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    const leads = await ctx.db
      .query("leads")
      .withIndex("by_submission", (q) => q.eq("submissionId", args.submissionId))
      .collect();
    return {
      total: leads.length,
      new: leads.filter((l) => l.status === "new").length,
      contacted: leads.filter((l) => l.status === "contacted").length,
      qualified: leads.filter((l) => l.status === "qualified").length,
      converted: leads.filter((l) => l.status === "converted").length,
      lost: leads.filter((l) => l.status === "lost").length,
    };
  },
});

// Delete a lead
export const remove = mutation({
  args: { id: v.id("leads") },
  handler: async (ctx, args) => {
    // Also delete associated notes
    const notes = await ctx.db
      .query("leadNotes")
      .withIndex("by_lead", (q) => q.eq("leadId", args.id))
      .collect();
    for (const note of notes) {
      await ctx.db.delete(note._id);
    }
    await ctx.db.delete(args.id);
  },
});
