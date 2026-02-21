import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

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
    referredByCode: v.optional(v.string()), // Referral code used during signup
  },
  handler: async (ctx, args) => {
    // Check if creator already exists
    const existing = await ctx.db
      .query("creators")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existing) {
      // Update lastActiveAt and fill in any missing default values
      await ctx.db.patch(existing._id, {
        lastActiveAt: Date.now(),
        role: existing.role || "creator",
        status: existing.status || "active",
        totalEarnings: existing.totalEarnings ?? 0,
      });
      return existing._id;
    }

    const now = Date.now();
    const creatorId = await ctx.db.insert("creators", {
      clerkId: args.clerkId,
      email: args.email,
      firstName: args.firstName,
      middleName: args.middleName,
      lastName: args.lastName,
      phone: args.phone,
      referralCode: args.referralCode,
      referredByCode: args.referredByCode,
      balance: 0,
      createdAt: now,
      lastActiveAt: now,
      role: "creator",
      status: "active",
      totalEarnings: 0,
    });

    // If signed up with a referral code, create referral record
    if (args.referredByCode) {
      const referrer = await ctx.db
        .query("creators")
        .withIndex("by_referral_code", (q) => q.eq("referralCode", args.referredByCode))
        .first();

      if (referrer && referrer._id !== creatorId) {
        await ctx.scheduler.runAfter(0, internal.referrals.createFromSignup, {
          referrerId: referrer._id,
          referredId: creatorId,
          referralCode: args.referredByCode,
        });
      }
    }

    return creatorId;
  },
});

export const update = mutation({
  args: {
    id: v.id("creators"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
    profileImage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);

    // Notify creator about profile update
    await ctx.scheduler.runAfter(0, internal.notifications.createAndSend, {
      creatorId: id,
      type: "profile_updated",
      title: "Profile Updated",
      body: args.profileImage
        ? "Your profile photo and details have been updated successfully."
        : "Your profile details have been updated successfully.",
      data: {},
    });
  },
});

export const updateLastActive = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const creator = await ctx.db
      .query("creators")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (creator) {
      await ctx.db.patch(creator._id, {
        lastActiveAt: Date.now(),
      });
    }
  },
});

export const certify = mutation({
  args: {
    id: v.id("creators"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      certifiedAt: Date.now(),
      lastActiveAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.notifications.createAndSend, {
      creatorId: args.id,
      type: "system",
      title: "Certification Complete!",
      body: "Congratulations! You are now a certified creator. You can start submitting businesses.",
      data: {},
    });
  },
});
