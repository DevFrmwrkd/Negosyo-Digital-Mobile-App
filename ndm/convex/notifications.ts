import { mutation, query, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ============================================================================
// Internal: Create notification + trigger push
// ============================================================================

export const createAndSend = internalMutation({
  args: {
    creatorId: v.id("creators"),
    type: v.union(
      v.literal("submission_approved"),
      v.literal("submission_rejected"),
      v.literal("new_lead"),
      v.literal("payout_sent"),
      v.literal("website_live"),
      v.literal("submission_created"),
      v.literal("profile_updated"),
      v.literal("password_changed"),
      v.literal("system"),
    ),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const notificationId = await ctx.db.insert("notifications", {
      creatorId: args.creatorId,
      type: args.type,
      title: args.title,
      body: args.body,
      data: args.data,
      read: false,
      sentAt: Date.now(),
    });

    // Schedule push notification delivery
    await ctx.scheduler.runAfter(0, internal.notifications.sendPushNotification, {
      creatorId: args.creatorId,
      title: args.title,
      body: args.body,
      data: args.data,
    });

    return notificationId;
  },
});

// ============================================================================
// Public: Create notification from client (for client-side events like password changes)
// ============================================================================

export const createForClient = mutation({
  args: {
    creatorId: v.id("creators"),
    type: v.union(
      v.literal("profile_updated"),
      v.literal("password_changed"),
      v.literal("system"),
    ),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notifications", {
      creatorId: args.creatorId,
      type: args.type,
      title: args.title,
      body: args.body,
      data: args.data,
      read: false,
      sentAt: Date.now(),
    });
  },
});

// ============================================================================
// Push Notification Delivery (Expo Push API)
// ============================================================================

export const sendPushNotification = internalAction({
  args: {
    creatorId: v.id("creators"),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Get all active push tokens for this creator
    const tokens = await ctx.runQuery(internal.notifications.getActiveTokens, {
      creatorId: args.creatorId,
    });

    if (tokens.length === 0) {
      console.log(`[Push] No active push tokens for creator ${args.creatorId}`);
      return;
    }

    // Build Expo push messages
    const messages = tokens.map((token) => ({
      to: token.token,
      sound: "default" as const,
      title: args.title,
      body: args.body,
      data: args.data || {},
    }));

    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        console.error(`[Push] Expo API error: ${response.status}`);
        return;
      }

      const result = await response.json();
      console.log(`[Push] Sent ${messages.length} notifications for creator ${args.creatorId}`);

      // Handle ticket errors (invalid tokens)
      if (result.data) {
        for (let i = 0; i < result.data.length; i++) {
          const ticket = result.data[i];
          if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
            // Deactivate invalid token
            await ctx.runMutation(internal.notifications.deactivateToken, {
              tokenId: tokens[i]._id,
            });
            console.log(`[Push] Deactivated invalid token: ${tokens[i].token.substring(0, 20)}...`);
          }
        }
      }
    } catch (error) {
      console.error(`[Push] Error sending push notifications:`, error);
    }
  },
});

// ============================================================================
// Push Token Management
// ============================================================================

export const registerPushToken = mutation({
  args: {
    creatorId: v.id("creators"),
    token: v.string(),
    platform: v.union(v.literal("ios"), v.literal("android"), v.literal("web")),
  },
  handler: async (ctx, args) => {
    // Check if token already exists
    const existing = await ctx.db
      .query("pushTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (existing) {
      // Reactivate if same creator, update creator if different device owner
      await ctx.db.patch(existing._id, {
        creatorId: args.creatorId,
        platform: args.platform,
        active: true,
      });
      return existing._id;
    }

    return await ctx.db.insert("pushTokens", {
      creatorId: args.creatorId,
      token: args.token,
      platform: args.platform,
      active: true,
    });
  },
});

export const removePushToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pushTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { active: false });
    }
  },
});

// Internal: get active tokens for push delivery
export const getActiveTokens = query({
  args: { creatorId: v.id("creators") },
  handler: async (ctx, args) => {
    const tokens = await ctx.db
      .query("pushTokens")
      .withIndex("by_creator", (q) => q.eq("creatorId", args.creatorId))
      .filter((q) => q.eq(q.field("active"), true))
      .collect();
    return tokens;
  },
});

// Internal: deactivate a specific token
export const deactivateToken = internalMutation({
  args: { tokenId: v.id("pushTokens") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.tokenId, { active: false });
  },
});

// ============================================================================
// Public Queries (for the app)
// ============================================================================

export const getByCreator = query({
  args: { creatorId: v.id("creators") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("notifications")
      .withIndex("by_creator", (q) => q.eq("creatorId", args.creatorId))
      .order("desc")
      .collect();
  },
});

export const getUnreadCount = query({
  args: { creatorId: v.id("creators") },
  handler: async (ctx, args) => {
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_creator_unread", (q) =>
        q.eq("creatorId", args.creatorId).eq("read", false)
      )
      .collect();
    return unread.length;
  },
});

export const markAsRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { read: true });
  },
});

export const markAllAsRead = mutation({
  args: { creatorId: v.id("creators") },
  handler: async (ctx, args) => {
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_creator_unread", (q) =>
        q.eq("creatorId", args.creatorId).eq("read", false)
      )
      .collect();

    for (const notification of unread) {
      await ctx.db.patch(notification._id, { read: true });
    }
  },
});
