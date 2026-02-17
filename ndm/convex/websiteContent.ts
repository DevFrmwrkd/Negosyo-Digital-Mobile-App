// DEPRECATED: websiteContent is consolidated into generatedWebsites.
// These functions are kept for backwards compatibility with the web app.
// New code should use generatedWebsites queries/mutations instead.

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// DEPRECATED: Use generatedWebsites.create instead
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
    console.warn("[DEPRECATED] websiteContent.create - use generatedWebsites instead");
    return await ctx.db.insert("websiteContent", args);
  },
});

// DEPRECATED: Use generatedWebsites.getBySubmissionId instead
export const getBySubmissionId = query({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    // Try generatedWebsites first, fall back to legacy websiteContent
    const website = await ctx.db
      .query("generatedWebsites")
      .withIndex("by_submission_id", (q) => q.eq("submissionId", args.submissionId))
      .first();

    if (website) return website;

    // Fallback to legacy table for old data
    return await ctx.db
      .query("websiteContent")
      .withIndex("by_submission_id", (q) => q.eq("submissionId", args.submissionId))
      .first();
  },
});

// DEPRECATED: Use generatedWebsites.update instead
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
    console.warn("[DEPRECATED] websiteContent.update - use generatedWebsites instead");
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});
