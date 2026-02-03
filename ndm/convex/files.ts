import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Legacy: Generate upload URL for Convex storage (kept for backwards compatibility)
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Helper to check if value is R2 key or Convex storage ID
const isR2Key = (value: string): boolean => {
  return value.includes("/") || value.startsWith("http");
};

// Get URL for a file - handles both R2 keys/URLs and legacy Convex storage IDs
export const getUrl = query({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    const value = args.storageId;

    // If it's already a full URL, return it
    if (value.startsWith("http")) {
      return value;
    }

    // If it contains a slash, it's an R2 file key - return public URL
    if (value.includes("/")) {
      const publicUrl = process.env.R2_PUBLIC_URL;
      if (publicUrl) {
        return `${publicUrl}/${value}`;
      }
      // Fallback: construct R2 URL
      const accountId = process.env.R2_ACCOUNT_ID;
      const bucketName = process.env.R2_BUCKET_NAME || "negosyo-digital";
      if (accountId) {
        return `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${value}`;
      }
    }

    // Legacy: Convex storage ID
    const cleanId = value.startsWith("convex:")
      ? value.replace("convex:", "")
      : value;
    return await ctx.storage.getUrl(cleanId);
  },
});

// Get multiple URLs - handles both R2 and Convex storage
export const getMultipleUrls = query({
  args: { storageIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const publicUrl = process.env.R2_PUBLIC_URL;
    const accountId = process.env.R2_ACCOUNT_ID;
    const bucketName = process.env.R2_BUCKET_NAME || "negosyo-digital";

    const urls = await Promise.all(
      args.storageIds.map(async (value) => {
        if (!value) return null;

        // Already a URL
        if (value.startsWith("http")) {
          return value;
        }

        // R2 file key
        if (value.includes("/")) {
          if (publicUrl) {
            return `${publicUrl}/${value}`;
          }
          if (accountId) {
            return `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${value}`;
          }
          return null;
        }

        // Legacy Convex storage ID
        const cleanId = value.startsWith("convex:")
          ? value.replace("convex:", "")
          : value;
        try {
          return await ctx.storage.getUrl(cleanId);
        } catch {
          return null;
        }
      })
    );

    return urls;
  },
});
