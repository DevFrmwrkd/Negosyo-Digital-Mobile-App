import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const creator = await ctx.db
      .query("creators")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    return creator;
  },
});

export const create = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    middleName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
    referralCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if creator already exists
    const existing = await ctx.db
      .query("creators")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existing) {
      // Update existing creator with default values if missing
      if (!existing.role || !existing.status || existing.totalEarnings === undefined) {
        await ctx.db.patch(existing._id, {
          role: existing.role || "creator",
          status: existing.status || "active",
          totalEarnings: existing.totalEarnings ?? 0,
        });
      }
      return existing._id;
    }

    const creatorId = await ctx.db.insert("creators", {
      clerkId: args.clerkId,
      email: args.email,
      firstName: args.firstName,
      middleName: args.middleName,
      lastName: args.lastName,
      phone: args.phone,
      referralCode: args.referralCode,
      balance: 0,
      createdAt: Date.now(),
      role: "creator",
      status: "active",
      totalEarnings: 0,
    });

    return creatorId;
  },
});

export const update = mutation({
  args: {
    id: v.id("creators"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});
