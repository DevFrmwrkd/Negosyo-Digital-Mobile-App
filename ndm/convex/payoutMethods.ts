import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Save a new payout method
export const save = mutation({
  args: {
    creatorId: v.id("creators"),
    type: v.union(v.literal("gcash"), v.literal("maya"), v.literal("bank_transfer")),
    accountName: v.string(),
    accountNumber: v.string(),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // If this is set as default, unset any existing default
    if (args.isDefault) {
      const existing = await ctx.db
        .query("payoutMethods")
        .withIndex("by_creator", (q) => q.eq("creatorId", args.creatorId))
        .collect();

      for (const method of existing) {
        if (method.isDefault) {
          await ctx.db.patch(method._id, { isDefault: false });
        }
      }
    }

    // Check if this is the first method — auto-set as default
    const existingMethods = await ctx.db
      .query("payoutMethods")
      .withIndex("by_creator", (q) => q.eq("creatorId", args.creatorId))
      .collect();

    const isFirstMethod = existingMethods.length === 0;

    return await ctx.db.insert("payoutMethods", {
      creatorId: args.creatorId,
      type: args.type,
      accountName: args.accountName,
      accountNumber: args.accountNumber,
      isDefault: args.isDefault ?? isFirstMethod,
    });
  },
});

// Update a payout method
export const update = mutation({
  args: {
    id: v.id("payoutMethods"),
    accountName: v.optional(v.string()),
    accountNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});

// Set a method as default
export const setDefault = mutation({
  args: {
    id: v.id("payoutMethods"),
  },
  handler: async (ctx, args) => {
    const method = await ctx.db.get(args.id);
    if (!method) throw new Error("Payout method not found");

    // Unset existing default
    const existing = await ctx.db
      .query("payoutMethods")
      .withIndex("by_creator", (q) => q.eq("creatorId", method.creatorId))
      .collect();

    for (const m of existing) {
      if (m.isDefault && m._id !== args.id) {
        await ctx.db.patch(m._id, { isDefault: false });
      }
    }

    await ctx.db.patch(args.id, { isDefault: true });
  },
});

// Get all payout methods for a creator
export const getByCreator = query({
  args: { creatorId: v.id("creators") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("payoutMethods")
      .withIndex("by_creator", (q) => q.eq("creatorId", args.creatorId))
      .collect();
  },
});

// Get the default payout method for a creator
export const getDefault = query({
  args: { creatorId: v.id("creators") },
  handler: async (ctx, args) => {
    const methods = await ctx.db
      .query("payoutMethods")
      .withIndex("by_creator", (q) => q.eq("creatorId", args.creatorId))
      .collect();
    return methods.find((m) => m.isDefault) ?? null;
  },
});

// Delete a payout method
export const remove = mutation({
  args: { id: v.id("payoutMethods") },
  handler: async (ctx, args) => {
    const method = await ctx.db.get(args.id);
    if (!method) throw new Error("Payout method not found");

    await ctx.db.delete(args.id);

    // If we deleted the default, set another one as default
    if (method.isDefault) {
      const remaining = await ctx.db
        .query("payoutMethods")
        .withIndex("by_creator", (q) => q.eq("creatorId", method.creatorId))
        .first();

      if (remaining) {
        await ctx.db.patch(remaining._id, { isDefault: true });
      }
    }
  },
});
