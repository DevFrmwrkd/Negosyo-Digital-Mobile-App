import { action, internalAction, internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Airtable Integration for AI Content Generation Pipeline
 *
 * Flow:
 * 1. Push submission to Airtable (triggers AI image generation)
 * 2. Schedule fetch after delay (AI takes time to generate)
 * 3. Fetch checks if ai_output is ready
 * 4. If ready: download image → store in Convex → update Airtable status to "done"
 * 5. If not ready: retry with exponential backoff (max 5 retries)
 *
 * Required Convex Environment Variables (set via `npx convex env set`):
 * - AIRTABLE_API_KEY: Personal access token from airtable.com/create/tokens
 * - AIRTABLE_BASE_ID: Base ID (starts with "app...")
 * - AIRTABLE_TABLE_ID: Table ID (starts with "tbl...")
 */

const AIRTABLE_API_BASE = "https://api.airtable.com/v0";

// Retry configuration
const INITIAL_FETCH_DELAY_MS = 30000; // 30 seconds - wait for AI to generate
const MAX_RETRIES = 5;
const RETRY_DELAYS_MS = [30000, 60000, 120000, 300000, 600000]; // 30s, 1m, 2m, 5m, 10m

// Validate and retrieve Airtable configuration from environment
function getAirtableConfig(): { apiKey: string; baseId: string; tableId: string } {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableId = process.env.AIRTABLE_TABLE_ID;

  const missing: string[] = [];
  if (!apiKey) missing.push("AIRTABLE_API_KEY");
  if (!baseId) missing.push("AIRTABLE_BASE_ID");
  if (!tableId) missing.push("AIRTABLE_TABLE_ID");

  if (missing.length > 0) {
    throw new Error(
      `Airtable configuration incomplete. Missing: ${missing.join(", ")}. ` +
        `Set these using: npx convex env set <VAR_NAME> <value>`
    );
  }

  if (!baseId.startsWith("app")) {
    throw new Error("Invalid AIRTABLE_BASE_ID format. Must start with 'app'");
  }
  if (!tableId.startsWith("tbl")) {
    throw new Error("Invalid AIRTABLE_TABLE_ID format. Must start with 'tbl'");
  }

  return { apiKey: apiKey!, baseId: baseId!, tableId: tableId! };
}

// Sanitize string input to prevent injection in Airtable formulas
function sanitizeForAirtable(input: string): string {
  if (!input) return "";
  return input
    .replace(/[\r\n]+/g, " ")
    .replace(/[{}]/g, "")
    .slice(0, 10000);
}

// ============================================================================
// STEP 1: Push to Airtable
// ============================================================================

// Public action to push submission to Airtable
export const pushToAirtable = action({
  args: {
    submissionId: v.id("submissions"),
  },
  handler: async (ctx, args) => {
    const config = getAirtableConfig();

    const submission = await ctx.runQuery(internal.airtable.getSubmissionById, {
      submissionId: args.submissionId,
    });

    if (!submission) {
      throw new Error("Submission not found");
    }

    if (submission.airtableRecordId) {
      console.log(`[Airtable] Submission ${args.submissionId} already has Airtable record`);
      return { success: true, airtableRecordId: submission.airtableRecordId, alreadyExists: true };
    }

    // Determine if business has products (affects expected photo count)
    const hasProducts = submission.hasProducts ?? true; // Default to true for backwards compatibility

    // Build fields object - field names must EXACTLY match Airtable column names
    const fields: Record<string, unknown> = {
      convex_record_id: args.submissionId,
      client_name: sanitizeForAirtable(submission.ownerName),
      business_name: sanitizeForAirtable(submission.businessName),
      business_type: sanitizeForAirtable(submission.businessType),
      transcript: sanitizeForAirtable(submission.transcript || ""),
      has_products: hasProducts,
      Status: "pending",
    };

    // Map photos by index to specific Airtable fields
    // Order convention: [0]=headshot, [1]=interior1, [2]=interior2, [3]=exterior, [4]=product1, [5]=product2
    // If hasProducts=false, only first 4 photos are expected
    if (submission.photos && submission.photos.length > 0) {
      const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "https://pub-57b18c6cff15455aa3dec88f7581c5d7.r2.dev";

      const buildAttachment = (photo: string) => {
        if (!photo) return null;
        const url = photo.startsWith("http") ? photo : `${R2_PUBLIC_URL}/${photo}`;
        return [{ url }];
      };

      // Map each photo to its specific field by index
      if (submission.photos[0]) fields.original_headshot = buildAttachment(submission.photos[0]);
      if (submission.photos[1]) fields.original_interior_1 = buildAttachment(submission.photos[1]);
      if (submission.photos[2]) fields.original_interior_2 = buildAttachment(submission.photos[2]);
      if (submission.photos[3]) fields.original_exterior = buildAttachment(submission.photos[3]);
      // Only include product photos if business has products
      if (hasProducts) {
        if (submission.photos[4]) fields.original_product_1 = buildAttachment(submission.photos[4]);
        if (submission.photos[5]) fields.original_product_2 = buildAttachment(submission.photos[5]);
      }
    }

    const recordData = { fields };

    console.log(`[Airtable] Pushing submission ${args.submissionId} (hasProducts: ${hasProducts})`);
    console.log(`[Airtable] Fields:`, JSON.stringify(fields, null, 2));

    const response = await fetch(`${AIRTABLE_API_BASE}/${config.baseId}/${config.tableId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ records: [recordData] }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[Airtable] API Error ${response.status}:`, errorBody);

      if (response.status === 401) {
        throw new Error("Airtable authentication failed. Check API key configuration.");
      } else if (response.status === 404) {
        throw new Error("Airtable base or table not found. Check configuration.");
      } else if (response.status === 422) {
        throw new Error("Invalid data format for Airtable. Check field names match your table.");
      } else {
        throw new Error(`Failed to create Airtable record (${response.status})`);
      }
    }

    const result = await response.json();
    const airtableRecordId = result.records?.[0]?.id;

    if (!airtableRecordId) {
      throw new Error("Airtable response missing record ID");
    }

    console.log(`[Airtable] Created record: ${airtableRecordId}`);

    await ctx.runMutation(internal.airtable.updateAirtableRecordId, {
      submissionId: args.submissionId,
      airtableRecordId,
    });

    // Schedule first fetch attempt after delay (AI needs time to generate)
    await ctx.scheduler.runAfter(INITIAL_FETCH_DELAY_MS, internal.airtable.fetchEnhancedContentWithRetry, {
      submissionId: args.submissionId,
      airtableRecordId,
      retryCount: 0,
      hasProducts,
    });

    console.log(`[Airtable] Scheduled fetch in ${INITIAL_FETCH_DELAY_MS / 1000}s`);

    return { success: true, airtableRecordId };
  },
});

// Internal action for scheduler (called when submission is submitted)
export const pushToAirtableInternal = internalAction({
  args: {
    submissionId: v.id("submissions"),
  },
  handler: async (ctx, args) => {
    const config = getAirtableConfig();

    const submission = await ctx.runQuery(internal.airtable.getSubmissionById, {
      submissionId: args.submissionId,
    });

    if (!submission) {
      console.error(`[Airtable] Submission ${args.submissionId} not found`);
      return { success: false, error: "Submission not found" };
    }

    if (submission.airtableRecordId) {
      console.log(`[Airtable] Submission ${args.submissionId} already has Airtable record`);
      return { success: true, airtableRecordId: submission.airtableRecordId, alreadyExists: true };
    }

    // Determine if business has products (affects expected photo count)
    const hasProducts = submission.hasProducts ?? true; // Default to true for backwards compatibility

    // Build fields object - field names must EXACTLY match Airtable column names
    const fields: Record<string, unknown> = {
      convex_record_id: args.submissionId,
      client_name: sanitizeForAirtable(submission.ownerName),
      business_name: sanitizeForAirtable(submission.businessName),
      business_type: sanitizeForAirtable(submission.businessType),
      transcript: sanitizeForAirtable(submission.transcript || ""),
      has_products: hasProducts,
      Status: "pending",
    };

    // Map photos by index to specific Airtable fields
    // Order convention: [0]=headshot, [1]=interior1, [2]=interior2, [3]=exterior, [4]=product1, [5]=product2
    // If hasProducts=false, only first 4 photos are expected
    if (submission.photos && submission.photos.length > 0) {
      const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "https://pub-57b18c6cff15455aa3dec88f7581c5d7.r2.dev";

      const buildAttachment = (photo: string) => {
        if (!photo) return null;
        const url = photo.startsWith("http") ? photo : `${R2_PUBLIC_URL}/${photo}`;
        return [{ url }];
      };

      // Map each photo to its specific field by index
      if (submission.photos[0]) fields.original_headshot = buildAttachment(submission.photos[0]);
      if (submission.photos[1]) fields.original_interior_1 = buildAttachment(submission.photos[1]);
      if (submission.photos[2]) fields.original_interior_2 = buildAttachment(submission.photos[2]);
      if (submission.photos[3]) fields.original_exterior = buildAttachment(submission.photos[3]);
      // Only include product photos if business has products
      if (hasProducts) {
        if (submission.photos[4]) fields.original_product_1 = buildAttachment(submission.photos[4]);
        if (submission.photos[5]) fields.original_product_2 = buildAttachment(submission.photos[5]);
      }
    }

    const recordData = { fields };

    console.log(`[Airtable] Pushing submission ${args.submissionId} (hasProducts: ${hasProducts})`);
    console.log(`[Airtable] Fields:`, JSON.stringify(fields, null, 2));

    try {
      const response = await fetch(`${AIRTABLE_API_BASE}/${config.baseId}/${config.tableId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ records: [recordData] }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[Airtable] API Error ${response.status}:`, errorBody);
        // Update status to error
        await ctx.runMutation(internal.airtable.updateSyncStatus, {
          submissionId: args.submissionId,
          status: "error",
        });
        return { success: false, error: `Airtable API error: ${response.status}` };
      }

      const result = await response.json();
      const airtableRecordId = result.records?.[0]?.id;

      if (!airtableRecordId) {
        await ctx.runMutation(internal.airtable.updateSyncStatus, {
          submissionId: args.submissionId,
          status: "error",
        });
        return { success: false, error: "Airtable response missing record ID" };
      }

      console.log(`[Airtable] Created record: ${airtableRecordId}`);

      await ctx.runMutation(internal.airtable.updateAirtableRecordId, {
        submissionId: args.submissionId,
        airtableRecordId,
      });

      // Schedule first fetch attempt after delay
      await ctx.scheduler.runAfter(INITIAL_FETCH_DELAY_MS, internal.airtable.fetchEnhancedContentWithRetry, {
        submissionId: args.submissionId,
        airtableRecordId,
        retryCount: 0,
        hasProducts,
      });

      console.log(`[Airtable] Scheduled fetch in ${INITIAL_FETCH_DELAY_MS / 1000}s`);

      return { success: true, airtableRecordId };
    } catch (error) {
      console.error(`[Airtable] Error pushing to Airtable:`, error);
      await ctx.runMutation(internal.airtable.updateSyncStatus, {
        submissionId: args.submissionId,
        status: "error",
      });
      return { success: false, error: String(error) };
    }
  },
});

// ============================================================================
// STEP 2: Fetch Enhanced Content (Images + AI Text) with Retry
// ============================================================================

// Type for structured enhanced images
type EnhancedImageField = "headshot" | "interior_1" | "interior_2" | "exterior" | "product_1" | "product_2";

interface EnhancedImageData {
  url: string;
  storageId: string;
}

// Internal action to fetch enhanced content from Airtable (with retry logic)
export const fetchEnhancedContentWithRetry = internalAction({
  args: {
    submissionId: v.id("submissions"),
    airtableRecordId: v.string(),
    retryCount: v.number(),
    hasProducts: v.boolean(),
  },
  handler: async (ctx, args) => {
    const config = getAirtableConfig();

    console.log(`[Airtable Fetch] Attempt ${args.retryCount + 1}/${MAX_RETRIES + 1} for ${args.submissionId}`);

    // Fetch the record from Airtable
    const response = await fetch(
      `${AIRTABLE_API_BASE}/${config.baseId}/${config.tableId}/${args.airtableRecordId}`,
      {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
      }
    );

    if (!response.ok) {
      console.error(`[Airtable Fetch] API error: ${response.status}`);

      // Schedule retry if not at max
      if (args.retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAYS_MS[args.retryCount] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
        await ctx.scheduler.runAfter(delay, internal.airtable.fetchEnhancedContentWithRetry, {
          submissionId: args.submissionId,
          airtableRecordId: args.airtableRecordId,
          retryCount: args.retryCount + 1,
          hasProducts: args.hasProducts,
        });
        console.log(`[Airtable Fetch] Scheduled retry in ${delay / 1000}s`);
      }
      return { success: false, error: `API error ${response.status}` };
    }

    const record = await response.json();
    const fields = record.fields || {};

    // Helper to extract URL from Airtable attachment field
    const getAttachmentUrl = (field: unknown): string | null => {
      if (!field) return null;
      if (typeof field === "string") return field;
      if (Array.isArray(field) && field[0]?.url) return field[0].url;
      return null;
    };

    // Helper to get text field value
    // Airtable AI fields return { state: "generated", value: "...", isStale: false }
    const getTextField = (field: unknown): string | null => {
      if (!field) return null;
      if (typeof field === "string") return field.trim();
      // Handle Airtable AI field format
      if (typeof field === "object" && field !== null) {
        const aiField = field as { state?: string; value?: string };
        if (aiField.state === "generated" && typeof aiField.value === "string") {
          return aiField.value.trim();
        }
      }
      return null;
    };

    // Define which original fields to check based on hasProducts
    const imageFieldsToCheck = args.hasProducts
      ? ["headshot", "interior_1", "interior_2", "exterior", "product_1", "product_2"]
      : ["headshot", "interior_1", "interior_2", "exterior"];

    // Check which original fields have images (to know how many enhanced we should expect)
    const originalFieldStatus = imageFieldsToCheck.map((name) => ({
      name,
      hasImage: !!getAttachmentUrl(fields[`original_${name}`]),
    }));
    const expectedEnhancedCount = originalFieldStatus.filter((f) => f.hasImage).length;

    // Collect enhanced images with their field names preserved
    const enhancedFieldsWithUrls = imageFieldsToCheck.map((name) => ({
      name: name as EnhancedImageField,
      url: getAttachmentUrl(fields[`enhanced_${name}`]),
    }));

    const readyEnhancedCount = enhancedFieldsWithUrls.filter((f) => f.url !== null).length;

    console.log(`[Airtable Fetch] Expected ${expectedEnhancedCount} enhanced images, found ${readyEnhancedCount}`);

    // Also check for AI text fields
    // Debug: log raw field values to see what Airtable AI fields return
    console.log(`[Airtable Fetch] Raw AI field values:`, JSON.stringify({
      hero_headline: fields.hero_headline,
      hero_subheadline: fields.hero_subheadline,
      about_content: fields.about_content,
      services_description: fields.services_description,
      contact_cta: fields.contact_cta,
    }, null, 2));

    const aiTextFields = {
      hero_headline: getTextField(fields.hero_headline),
      hero_subheadline: getTextField(fields.hero_subheadline),
      about_content: getTextField(fields.about_content),
      services_description: getTextField(fields.services_description),
      contact_cta: getTextField(fields.contact_cta),
    };

    const hasAllTextFields = Object.values(aiTextFields).every((v) => v !== null);
    console.log(`[Airtable Fetch] AI text fields ready: ${hasAllTextFields}`, aiTextFields);

    // Wait for ALL expected enhanced images AND text fields before proceeding
    if (readyEnhancedCount < expectedEnhancedCount || !hasAllTextFields) {
      console.log(
        `[Airtable Fetch] Waiting: images ${readyEnhancedCount}/${expectedEnhancedCount}, text fields ${hasAllTextFields}`
      );

      // Schedule retry if not at max
      if (args.retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAYS_MS[args.retryCount] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
        await ctx.scheduler.runAfter(delay, internal.airtable.fetchEnhancedContentWithRetry, {
          submissionId: args.submissionId,
          airtableRecordId: args.airtableRecordId,
          retryCount: args.retryCount + 1,
          hasProducts: args.hasProducts,
        });
        console.log(`[Airtable Fetch] Scheduled retry in ${delay / 1000}s`);
        return { success: false, status: "waiting", retryScheduled: true };
      } else {
        console.error(`[Airtable Fetch] Max retries reached for ${args.submissionId}`);
        await ctx.runMutation(internal.airtable.updateSyncStatus, {
          submissionId: args.submissionId,
          status: "error",
        });
        return { success: false, error: "Max retries reached - AI generation may have failed" };
      }
    }

    console.log(`[Airtable Fetch] All content ready for ${args.submissionId}`);

    // Download and store enhanced images with field names preserved
    try {
      const enhancedImages: Record<string, EnhancedImageData> = {};

      for (const field of enhancedFieldsWithUrls) {
        if (!field.url) continue;

        console.log(`[Airtable Fetch] Downloading ${field.name}...`);

        const imageResponse = await fetch(field.url);
        if (!imageResponse.ok) {
          console.error(`[Airtable Fetch] Failed to download ${field.name}: ${imageResponse.status}`);
          continue;
        }

        const imageBlob = await imageResponse.blob();
        console.log(`[Airtable Fetch] Downloaded ${field.name}: ${imageBlob.size} bytes`);

        // Store in Convex storage
        const storageId = await ctx.storage.store(imageBlob);
        const storedImageUrl = await ctx.storage.getUrl(storageId);

        if (storedImageUrl) {
          enhancedImages[field.name] = {
            url: storedImageUrl,
            storageId: storageId,
          };
          console.log(`[Airtable Fetch] Stored ${field.name} in Convex: ${storageId}`);
        }
      }

      if (Object.keys(enhancedImages).length === 0) {
        throw new Error("Failed to store any images");
      }

      console.log(`[Airtable Fetch] Successfully stored ${Object.keys(enhancedImages).length} images`);

      // Save to generatedWebsites table
      // Mapping: Airtable field → Convex generatedWebsites field
      // hero_headline → heroHeadline
      // hero_subheadline → heroSubHeadline
      // about_content → aboutDescription
      // services_description → servicesDescription
      // contact_cta → contactCta
      await ctx.runMutation(internal.airtable.saveEnhancedContent, {
        submissionId: args.submissionId,
        enhancedImages,
        aiTextFields: {
          heroHeadline: aiTextFields.hero_headline || undefined,
          heroSubHeadline: aiTextFields.hero_subheadline || undefined,
          aboutDescription: aiTextFields.about_content || undefined,
          servicesDescription: aiTextFields.services_description || undefined,
          contactCta: aiTextFields.contact_cta || undefined,
        },
      });

      // Update submission sync status
      await ctx.runMutation(internal.airtable.updateSyncStatus, {
        submissionId: args.submissionId,
        status: "synced",
      });

      // Update Airtable status to "done" to mark completion
      await fetch(
        `${AIRTABLE_API_BASE}/${config.baseId}/${config.tableId}/${args.airtableRecordId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fields: { Status: "done" },
          }),
        }
      );

      console.log(`[Airtable Fetch] Complete! Saved to generatedWebsites and updated Airtable status to done`);

      return {
        success: true,
        storedImageCount: Object.keys(enhancedImages).length,
        imageFields: Object.keys(enhancedImages),
        textFieldsReceived: Object.keys(aiTextFields).filter(
          (k) => aiTextFields[k as keyof typeof aiTextFields] !== null
        ),
      };
    } catch (error) {
      console.error(`[Airtable Fetch] Error downloading/storing content:`, error);
      await ctx.runMutation(internal.airtable.updateSyncStatus, {
        submissionId: args.submissionId,
        status: "error",
      });
      return { success: false, error: String(error) };
    }
  },
});

// Keep old function for backwards compatibility (deprecated)
export const fetchEnhancedImageWithRetry = internalAction({
  args: {
    submissionId: v.id("submissions"),
    airtableRecordId: v.string(),
    retryCount: v.number(),
  },
  handler: async (ctx, args) => {
    // Redirect to new function with default hasProducts=true
    await ctx.scheduler.runAfter(0, internal.airtable.fetchEnhancedContentWithRetry, {
      submissionId: args.submissionId,
      airtableRecordId: args.airtableRecordId,
      retryCount: args.retryCount,
      hasProducts: true,
    });
    return { success: true, message: "Redirected to fetchEnhancedContentWithRetry" };
  },
});

// ============================================================================
// Manual Pull (for admin/debugging)
// ============================================================================

// Pull AI-generated content from a specific Airtable record (manual trigger)
export const pullFromAirtable = action({
  args: {
    submissionId: v.id("submissions"),
  },
  handler: async (ctx, args) => {
    // Validate config is set (will throw if not configured)
    getAirtableConfig();

    const submission = await ctx.runQuery(internal.airtable.getSubmissionById, {
      submissionId: args.submissionId,
    });

    if (!submission) {
      throw new Error("Submission not found");
    }

    if (!submission.airtableRecordId) {
      throw new Error("No Airtable record linked. Push to Airtable first.");
    }

    // Determine if business has products
    const hasProducts = submission.hasProducts ?? true;

    // Trigger fetch with retry using new content-aware function
    await ctx.scheduler.runAfter(0, internal.airtable.fetchEnhancedContentWithRetry, {
      submissionId: args.submissionId,
      airtableRecordId: submission.airtableRecordId,
      retryCount: 0,
      hasProducts,
    });

    return { success: true, message: "Fetch scheduled" };
  },
});

// ============================================================================
// Internal Mutations
// ============================================================================

export const getSubmissionById = query({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.submissionId);
  },
});

export const updateAirtableRecordId = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    airtableRecordId: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.airtableRecordId.startsWith("rec")) {
      throw new Error("Invalid Airtable record ID format");
    }

    await ctx.db.patch(args.submissionId, {
      airtableRecordId: args.airtableRecordId,
      airtableSyncStatus: "pushed",
    });
  },
});

export const saveEnhancedImage = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    enhancedImageUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) {
      throw new Error("Submission not found");
    }

    await ctx.db.patch(args.submissionId, {
      airtableSyncStatus: "content_received",
      enhancedImageUrl: args.enhancedImageUrl,
    });

    console.log(`[Airtable] Saved enhanced image for ${args.submissionId}`);
  },
});

export const saveEnhancedImageWithStorageId = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    enhancedImageUrl: v.string(),
    enhancedImageStorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) {
      throw new Error("Submission not found");
    }

    await ctx.db.patch(args.submissionId, {
      airtableSyncStatus: "synced",
      enhancedImageUrl: args.enhancedImageUrl,
      enhancedImageStorageId: args.enhancedImageStorageId,
    });

    console.log(`[Airtable] Saved enhanced image with storage ID for ${args.submissionId}`);
  },
});

// Save ALL enhanced images (multiple) - DEPRECATED: use saveEnhancedContent instead
export const saveAllEnhancedImages = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    enhancedImageUrls: v.array(v.string()),
    enhancedImageStorageIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) {
      throw new Error("Submission not found");
    }

    // Just update sync status - images now go to generatedWebsites
    await ctx.db.patch(args.submissionId, {
      airtableSyncStatus: "synced",
    });

    console.log(`[Airtable] DEPRECATED: saveAllEnhancedImages called. Use saveEnhancedContent instead.`);
  },
});

// Save enhanced content (images + AI text) to generatedWebsites table
export const saveEnhancedContent = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    enhancedImages: v.object({
      headshot: v.optional(v.object({ url: v.string(), storageId: v.string() })),
      interior_1: v.optional(v.object({ url: v.string(), storageId: v.string() })),
      interior_2: v.optional(v.object({ url: v.string(), storageId: v.string() })),
      exterior: v.optional(v.object({ url: v.string(), storageId: v.string() })),
      product_1: v.optional(v.object({ url: v.string(), storageId: v.string() })),
      product_2: v.optional(v.object({ url: v.string(), storageId: v.string() })),
    }),
    aiTextFields: v.object({
      heroHeadline: v.optional(v.string()),
      heroSubHeadline: v.optional(v.string()),
      aboutDescription: v.optional(v.string()),
      servicesDescription: v.optional(v.string()),
      contactCta: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) {
      throw new Error("Submission not found");
    }

    // Build the enhancedImages object for storage (converting string IDs to proper storage IDs)
    const enhancedImagesForDb: Record<string, { url?: string; storageId?: any }> = {};

    for (const [key, value] of Object.entries(args.enhancedImages)) {
      if (value) {
        enhancedImagesForDb[key] = {
          url: value.url,
          storageId: value.storageId as any,
        };
      }
    }

    // Content fields to save
    const contentFields = {
      businessName: submission.businessName,
      heroHeadline: args.aiTextFields.heroHeadline,
      heroSubHeadline: args.aiTextFields.heroSubHeadline,
      aboutDescription: args.aiTextFields.aboutDescription,
      servicesDescription: args.aiTextFields.servicesDescription,
      contactCta: args.aiTextFields.contactCta,
      enhancedImages: enhancedImagesForDb as any,
      airtableSyncedAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Check if generatedWebsites record already exists for this submission
    const existingWebsite = await ctx.db
      .query("generatedWebsites")
      .withIndex("by_submission_id", (q) => q.eq("submissionId", args.submissionId))
      .first();

    if (existingWebsite) {
      await ctx.db.patch(existingWebsite._id, contentFields);
      console.log(`[Airtable] Updated generatedWebsites content for ${args.submissionId}`);
    } else {
      await ctx.db.insert("generatedWebsites", {
        submissionId: args.submissionId,
        ...contentFields,
      });
      console.log(`[Airtable] Created generatedWebsites with content for ${args.submissionId}`);
    }

    console.log(`[Airtable] Saved enhanced content with ${Object.keys(args.enhancedImages).length} images and ${Object.keys(args.aiTextFields).filter(k => args.aiTextFields[k as keyof typeof args.aiTextFields]).length} text fields`);
  },
});

export const updateSyncStatus = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.submissionId, {
      airtableSyncStatus: args.status,
    });
  },
});

// Internal action for webhook (kept for future use if they upgrade plan)
export const downloadAndStoreEnhancedImage = internalAction({
  args: {
    submissionId: v.id("submissions"),
    sourceImageUrl: v.string(),
  },
  handler: async (ctx, args) => {
    console.log(`[Airtable] Downloading enhanced image for ${args.submissionId}`);

    try {
      const imageResponse = await fetch(args.sourceImageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to download image: ${imageResponse.status}`);
      }

      const imageBlob = await imageResponse.blob();
      const storageId = await ctx.storage.store(imageBlob);
      const storedImageUrl = await ctx.storage.getUrl(storageId);

      if (!storedImageUrl) {
        throw new Error("Failed to get storage URL");
      }

      await ctx.runMutation(internal.airtable.saveEnhancedImageWithStorageId, {
        submissionId: args.submissionId,
        enhancedImageUrl: storedImageUrl,
        enhancedImageStorageId: storageId,
      });

      return { success: true, storageId, storedImageUrl };
    } catch (error) {
      console.error(`[Airtable] Error downloading/storing image:`, error);

      await ctx.runMutation(internal.airtable.saveEnhancedImage, {
        submissionId: args.submissionId,
        enhancedImageUrl: args.sourceImageUrl,
      });

      return { success: false, error: String(error), fallbackUrl: args.sourceImageUrl };
    }
  },
});

// ============================================================================
// Public Queries
// ============================================================================

export const getSyncStatus = query({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) return null;

    // Check generatedWebsites for content
    const website = await ctx.db
      .query("generatedWebsites")
      .withIndex("by_submission_id", (q) => q.eq("submissionId", args.submissionId))
      .first();

    return {
      airtableRecordId: submission.airtableRecordId || null,
      syncStatus: submission.airtableSyncStatus || null,
      hasWebsiteContent: !!(website?.enhancedImages || website?.heroHeadline),
      websiteId: website?._id || null,
      airtableSyncedAt: website?.airtableSyncedAt || null,
    };
  },
});

// Get enhanced content from generatedWebsites table
export const getEnhancedContent = query({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    const website = await ctx.db
      .query("generatedWebsites")
      .withIndex("by_submission_id", (q) => q.eq("submissionId", args.submissionId))
      .first();

    if (!website) return null;

    return {
      enhancedImages: website.enhancedImages || null,
      heroHeadline: website.heroHeadline || null,
      heroSubHeadline: website.heroSubHeadline || null,
      aboutDescription: website.aboutDescription || null,
      servicesDescription: website.servicesDescription || null,
      contactCta: website.contactCta || null,
      airtableSyncedAt: website.airtableSyncedAt || null,
    };
  },
});
