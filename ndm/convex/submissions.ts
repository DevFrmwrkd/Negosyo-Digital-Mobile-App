import { mutation, query, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getTodayString, getCurrentMonthString } from "./analytics";

export const create = mutation({
  args: {
    creatorId: v.id("creators"),
    businessName: v.string(),
    businessType: v.string(),
    ownerName: v.string(),
    ownerPhone: v.string(),
    ownerEmail: v.optional(v.string()),
    address: v.string(),
    city: v.string(),
    province: v.optional(v.string()),
    barangay: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    coordinates: v.optional(v.object({
      lat: v.number(),
      lng: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const submissionId = await ctx.db.insert("submissions", {
      ...args,
      status: "draft",
      photos: [],
    });

    // Increment creator's submissionCount
    const creator = await ctx.db.get(args.creatorId);
    if (creator) {
      await ctx.db.patch(args.creatorId, {
        submissionCount: (creator.submissionCount || 0) + 1,
        lastActiveAt: Date.now(),
      });
    }

    // Notify creator that submission was started
    await ctx.scheduler.runAfter(0, internal.notifications.createAndSend, {
      creatorId: args.creatorId,
      type: "submission_created",
      title: "New Submission Started",
      body: `Your submission for "${args.businessName}" has been created. Complete all steps to submit it for review.`,
      data: { submissionId },
    });

    return submissionId;
  },
});

export const getById = query({
  args: { id: v.id("submissions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByIdWithCreator = query({
  args: { id: v.id("submissions") },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.id);
    if (!submission) return null;

    const creator = await ctx.db.get(submission.creatorId);

    // Fetch generated website to get deployed URL
    const generatedWebsite = await ctx.db
      .query("generatedWebsites")
      .withIndex("by_submission_id", (q) => q.eq("submissionId", args.id))
      .first();

    const deployedUrl = generatedWebsite?.deployedUrl || generatedWebsite?.publishedUrl || null;

    return { ...submission, creator, deployedUrl };
  },
});

export const getByCreatorId = query({
  args: { creatorId: v.id("creators") },
  handler: async (ctx, args) => {
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_creator_id", (q) => q.eq("creatorId", args.creatorId))
      .order("desc")
      .collect();
    return submissions;
  },
});

export const getDraftByCreatorId = query({
  args: { creatorId: v.id("creators") },
  handler: async (ctx, args) => {
    const drafts = await ctx.db
      .query("submissions")
      .withIndex("by_creator_id", (q) => q.eq("creatorId", args.creatorId))
      .filter((q) => q.eq(q.field("status"), "draft"))
      .order("desc")
      .collect();
    return drafts.length > 0 ? drafts[0] : null;
  },
});

export const update = mutation({
  args: {
    id: v.id("submissions"),
    businessName: v.optional(v.string()),
    businessType: v.optional(v.string()),
    businessDescription: v.optional(v.string()),
    ownerName: v.optional(v.string()),
    ownerPhone: v.optional(v.string()),
    ownerEmail: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    province: v.optional(v.string()),
    barangay: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    coordinates: v.optional(v.object({
      lat: v.number(),
      lng: v.number(),
    })),
    photos: v.optional(v.array(v.string())),
    hasProducts: v.optional(v.boolean()), // Whether this business sells products (affects expected photo count)
    videoStorageId: v.optional(v.string()),
    audioStorageId: v.optional(v.string()),
    creatorPayout: v.optional(v.number()),
    platformFee: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    // Filter out undefined values
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );

    await ctx.db.patch(id, filteredUpdates);

    // If video or audio was uploaded, trigger transcription
    // Prioritize audio file for transcription (smaller file, more reliable)
    if (args.videoStorageId || args.audioStorageId) {
      // For video interviews with parallel audio, use audio for transcription
      // Otherwise use whatever media was uploaded
      const storageId = args.audioStorageId || args.videoStorageId;
      const mediaType = args.audioStorageId ? "audio" : "video";

      console.log(`[Transcription] Triggering transcription for ${mediaType} file: ${storageId}`);

      // Schedule transcription action
      await ctx.scheduler.runAfter(0, internal.submissions.transcribeMedia, {
        submissionId: id,
        storageId: storageId!,
        mediaType,
      });
    }
  },
});

export const submit = mutation({
  args: { id: v.id("submissions") },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.id);
    if (!submission) {
      throw new Error("Submission not found");
    }

    if (!submission.photos || submission.photos.length < 3) {
      throw new Error("At least 3 photos are required");
    }

    await ctx.db.patch(args.id, {
      status: "submitted",
      amount: 1000, // Fixed amount for all submissions
      // Initialize Airtable sync status
      airtableSyncStatus: "pending_push",
    });

    // Create a lead record from the business owner info
    await ctx.db.insert("leads", {
      submissionId: args.id,
      creatorId: submission.creatorId,
      source: "direct",
      name: submission.ownerName,
      phone: submission.ownerPhone,
      email: submission.ownerEmail,
      status: "new",
      createdAt: Date.now(),
    });

    // Analytics — increment submissionsCount
    const today = getTodayString();
    const month = getCurrentMonthString();
    await ctx.scheduler.runAfter(0, internal.analytics.incrementStat, {
      creatorId: submission.creatorId,
      period: today,
      periodType: "daily",
      field: "submissionsCount",
      delta: 1,
    });
    await ctx.scheduler.runAfter(0, internal.analytics.incrementStat, {
      creatorId: submission.creatorId,
      period: month,
      periodType: "monthly",
      field: "submissionsCount",
      delta: 1,
    });

    // Schedule push to Airtable for AI image enhancement
    await ctx.scheduler.runAfter(0, internal.airtable.pushToAirtableInternal, {
      submissionId: args.id,
    });
  },
});

// Internal mutation to update transcription
export const updateTranscription = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    transcription: v.string(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Save to 'transcript' field (existing field name in schema)
    const updates: Record<string, any> = {
      transcript: args.transcription,
    };
    if (args.status) {
      updates.transcriptionStatus = args.status;
    }
    await ctx.db.patch(args.submissionId, updates);
  },
});

// Internal mutation to update transcription status only
export const updateTranscriptionStatus = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    status: v.string(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, any> = {
      transcriptionStatus: args.status,
    };
    if (args.errorMessage) {
      updates.transcriptionError = args.errorMessage;
    }
    await ctx.db.patch(args.submissionId, updates);
  },
});

// Internal action to transcribe media using Groq API
export const transcribeMedia = internalAction({
  args: {
    submissionId: v.id("submissions"),
    storageId: v.string(),
    mediaType: v.string(),
  },
  handler: async (ctx, args) => {
    console.log(`[Transcription] Starting for submission ${args.submissionId}`);
    console.log(`[Transcription] Media type: ${args.mediaType}, Storage ID: ${args.storageId}`);

    // Set status to processing
    await ctx.runMutation(internal.submissions.updateTranscriptionStatus, {
      submissionId: args.submissionId,
      status: "processing",
    });

    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    if (!GROQ_API_KEY) {
      console.error("[Transcription] ERROR: GROQ_API_KEY not configured!");
      console.error("[Transcription] To fix: Run 'npx convex env set GROQ_API_KEY your_api_key_here'");
      await ctx.runMutation(internal.submissions.updateTranscriptionStatus, {
        submissionId: args.submissionId,
        status: "failed",
        errorMessage: "Transcription service not configured",
      });
      return;
    }

    console.log("[Transcription] GROQ_API_KEY is configured");

    try {
      let fileUrl: string | null = null;
      const storageValue = args.storageId;

      console.log(`[Transcription] Storage value: ${storageValue}`);

      // Determine if it's R2 or Convex storage
      if (storageValue.startsWith("http")) {
        // Already a full URL (R2 public URL)
        fileUrl = storageValue;
      } else if (storageValue.includes("/")) {
        // R2 file key - construct URL
        const publicUrl = process.env.R2_PUBLIC_URL;
        const accountId = process.env.R2_ACCOUNT_ID;
        const bucketName = process.env.R2_BUCKET_NAME || "negosyo-digital";

        if (publicUrl) {
          fileUrl = `${publicUrl}/${storageValue}`;
        } else if (accountId) {
          fileUrl = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${storageValue}`;
        }
      } else {
        // Legacy Convex storage ID
        const cleanStorageId = storageValue.startsWith("convex:")
          ? storageValue.replace("convex:", "")
          : storageValue;
        fileUrl = await ctx.storage.getUrl(cleanStorageId);
      }

      if (!fileUrl) {
        console.error("[Transcription] Could not get file URL for:", storageValue);
        await ctx.runMutation(internal.submissions.updateTranscriptionStatus, {
          submissionId: args.submissionId,
          status: "failed",
          errorMessage: "Could not retrieve media file",
        });
        return;
      }

      console.log(`[Transcription] File URL obtained: ${fileUrl.substring(0, 50)}...`);

      // Download the file
      console.log("[Transcription] Downloading file...");
      const fileResponse = await fetch(fileUrl);
      if (!fileResponse.ok) {
        throw new Error(`Failed to download file: ${fileResponse.status}`);
      }

      const fileBlob = await fileResponse.blob();
      const fileSizeMB = fileBlob.size / (1024 * 1024);
      console.log(`[Transcription] File downloaded, size: ${fileBlob.size} bytes (${fileSizeMB.toFixed(2)} MB)`);

      // Groq Whisper API has a 25MB limit
      const MAX_FILE_SIZE_MB = 25;
      if (fileSizeMB > MAX_FILE_SIZE_MB) {
        console.log(`[Transcription] File too large (${fileSizeMB.toFixed(2)} MB > ${MAX_FILE_SIZE_MB} MB limit)`);

        // For video files, try to inform user - audio-only recording would work better
        const errorMessage = args.mediaType === "video"
          ? `Video file too large (${fileSizeMB.toFixed(0)}MB). Try recording a shorter video or use audio-only interview for automatic transcription.`
          : `Audio file too large (${fileSizeMB.toFixed(0)}MB). Try recording a shorter interview.`;

        await ctx.runMutation(internal.submissions.updateTranscriptionStatus, {
          submissionId: args.submissionId,
          status: "skipped",
          errorMessage: errorMessage,
        });
        return;
      }

      // Create form data for Groq API
      const formData = new FormData();
      const fileName = args.mediaType === "video" ? "interview.mp4" : "interview.m4a";
      formData.append("file", fileBlob, fileName);
      formData.append("model", "whisper-large-v3");
      formData.append("language", "en");
      formData.append("response_format", "text");

      // Call Groq Whisper API
      console.log("[Transcription] Calling Groq Whisper API...");
      const transcriptionResponse = await fetch(
        "https://api.groq.com/openai/v1/audio/transcriptions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
          },
          body: formData,
        }
      );

      if (!transcriptionResponse.ok) {
        const errorText = await transcriptionResponse.text();
        console.error("[Transcription] Groq API error:", transcriptionResponse.status, errorText);

        // Handle specific error codes
        let errorMessage = "Transcription failed";
        if (transcriptionResponse.status === 413) {
          errorMessage = args.mediaType === "video"
            ? "Video file too large for transcription. Try using audio-only interview."
            : "Audio file too large for transcription. Try a shorter recording.";
          await ctx.runMutation(internal.submissions.updateTranscriptionStatus, {
            submissionId: args.submissionId,
            status: "skipped",
            errorMessage: errorMessage,
          });
        } else {
          await ctx.runMutation(internal.submissions.updateTranscriptionStatus, {
            submissionId: args.submissionId,
            status: "failed",
            errorMessage: `Transcription error: ${transcriptionResponse.status}`,
          });
        }
        return;
      }

      const transcription = await transcriptionResponse.text();
      console.log(`[Transcription] Success! Length: ${transcription.length} chars`);
      console.log(`[Transcription] Preview: ${transcription.substring(0, 100)}...`);

      // Save transcription to database
      await ctx.runMutation(internal.submissions.updateTranscription, {
        submissionId: args.submissionId,
        transcription: transcription,
        status: "complete",
      });

      console.log("[Transcription] Saved to database successfully!");
    } catch (error) {
      console.error("[Transcription] Error:", error);
      await ctx.runMutation(internal.submissions.updateTranscriptionStatus, {
        submissionId: args.submissionId,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  },
});

// Admin queries
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("submissions").order("desc").collect();
  },
});

export const getByStatus = query({
  args: { status: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("submissions")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .order("desc")
      .collect();
  },
});
