import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    submissionId: v.id("submissions"),
    heroTitle: v.optional(v.string()),
    heroSubtitle: v.optional(v.string()),
    aboutText: v.optional(v.string()),
    services: v.optional(v.array(v.string())),
    contactInfo: v.optional(
      v.object({
        phone: v.optional(v.string()),
        email: v.optional(v.string()),
        address: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("websiteContent", args);
  },
});

export const getBySubmissionId = query({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("websiteContent")
      .withIndex("by_submission_id", (q) => q.eq("submissionId", args.submissionId))
      .first();
  },
});

export const update = mutation({
  args: {
    id: v.id("websiteContent"),
    heroTitle: v.optional(v.string()),
    heroSubtitle: v.optional(v.string()),
    aboutText: v.optional(v.string()),
    services: v.optional(v.array(v.string())),
    contactInfo: v.optional(
      v.object({
        phone: v.optional(v.string()),
        email: v.optional(v.string()),
        address: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});
