import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const deleteFile = mutation({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    await ctx.storage.delete(args.storageId);
  },
});
