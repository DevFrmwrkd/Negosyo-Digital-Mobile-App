import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    submissionId: v.id("submissions"),
    html: v.optional(v.string()),
    css: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("generatedWebsites", args);
  },
});

export const getBySubmissionId = query({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("generatedWebsites")
      .withIndex("by_submission_id", (q) => q.eq("submissionId", args.submissionId))
      .first();
  },
});

export const update = mutation({
  args: {
    id: v.id("generatedWebsites"),
    html: v.optional(v.string()),
    css: v.optional(v.string()),
    deployedUrl: v.optional(v.string()),
    // Content fields
    heroTitle: v.optional(v.string()),
    heroSubtitle: v.optional(v.string()),
    heroHeadline: v.optional(v.string()),
    heroSubHeadline: v.optional(v.string()),
    aboutText: v.optional(v.string()),
    aboutDescription: v.optional(v.string()),
    aboutContent: v.optional(v.string()),
    businessName: v.optional(v.string()),
    tagline: v.optional(v.string()),
    servicesDescription: v.optional(v.string()),
    contactCta: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, { ...updates, updatedAt: Date.now() });
  },
});
