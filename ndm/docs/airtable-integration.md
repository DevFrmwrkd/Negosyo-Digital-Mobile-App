# Airtable AI Integration Documentation

## Overview

This document describes the Airtable integration for AI-powered image enhancement and content generation in the NDM (Negosyo Digital Mobile) application.

---

## Changelog

### Session Changes (2026-02-04)

#### Schema Changes (`convex/schema.ts`)

1. **Added `hasProducts` field to submissions table**
   - Type: `v.optional(v.boolean())`
   - Purpose: Controls whether product photos are expected (affects photo count)
   - Default: `true` for backwards compatibility

2. **Added AI text fields to websiteContent table**
   - `aboutContent` → renamed usage to `aboutDescription`
   - `servicesDescription` - AI-generated services description
   - `contactCta` - AI-generated contact call-to-action

3. **Added structured `enhancedImages` to websiteContent table**
   ```typescript
   enhancedImages: v.optional(v.object({
     headshot: v.optional(v.object({ url, storageId })),
     interior_1: v.optional(v.object({ url, storageId })),
     interior_2: v.optional(v.object({ url, storageId })),
     exterior: v.optional(v.object({ url, storageId })),
     product_1: v.optional(v.object({ url, storageId })),
     product_2: v.optional(v.object({ url, storageId })),
   }))
   ```

4. **Added `airtableSyncedAt` to websiteContent table**
   - Tracks when content was synced from Airtable

5. **Kept deprecated fields in submissions for backwards compatibility**
   - `enhancedImageUrl`, `enhancedImageStorageId`, `enhancedImageUrls`, `enhancedImageStorageIds`
   - These are no longer used but kept for existing data

#### Airtable Push Changes (`convex/airtable.ts`)

1. **Added new fields to Airtable push**
   - `business_type` - Type of business
   - `transcript` - Audio interview transcription (for AI text generation)
   - `has_products` - Boolean for conditional product logic

2. **Added conditional product logic**
   - If `hasProducts=false`, only 4 photos expected (no product_1, product_2)
   - Affects both push and fetch operations

#### Airtable Fetch Changes (`convex/airtable.ts`)

1. **Created new `fetchEnhancedContentWithRetry` function**
   - Replaces old `fetchEnhancedImageWithRetry`
   - Fetches both images AND AI text fields
   - Preserves field names (not just array indexes)

2. **Added AI text field fetching**
   - `hero_headline` → `heroHeadline`
   - `hero_subheadline` → `heroSubHeadline`
   - `about_content` → `aboutDescription`
   - `services_description` → `servicesDescription`
   - `contact_cta` → `contactCta`

3. **Changed storage location**
   - Enhanced content now saves to `websiteContent` table (not `submissions`)
   - Images stored with field names preserved (structured object)

4. **Added `hasProducts` parameter**
   - Controls which image fields to check/fetch

#### New Mutations/Queries (`convex/airtable.ts`)

1. **`saveEnhancedContent`** - Saves enhanced images + AI text to websiteContent
2. **`getEnhancedContent`** - Query to retrieve enhanced content
3. **Updated `getSyncStatus`** - Now includes websiteContent info

#### Submissions Changes (`convex/submissions.ts`)

1. **Added `hasProducts` to update mutation args**
   - Allows mobile app to set whether business has products

---

## Data Flow

```
Mobile App (Expo/React Native)
    │
    ▼
Convex Backend (submissions table)
    │
    ▼ Push to Airtable
Airtable (AI Processing)
    │
    ├── AI Image Enhancement (Gemini 3 Pro Image)
    │   └── Enhanced headshot, interior, exterior, product images
    │
    └── AI Text Generation (GPT-4.1)
        └── Hero headline, about content, services, contact CTA
    │
    ▼ Fetch from Airtable
Convex Backend (websiteContent table)
    │
    ▼
Website Homepage
```

---

## Airtable Table Configuration

### Required Fields

#### Input Fields (from Convex)

| Field Name | Type | Description |
|------------|------|-------------|
| `convex_record_id` | Single line text | Convex submission ID |
| `client_name` | Single line text | Business owner name |
| `business_name` | Single line text | Name of the business |
| `business_type` | Single line text | Type (salon, restaurant, retail, etc.) |
| `transcript` | Long text | Audio interview transcription |
| `has_products` | Checkbox | Whether business sells products |
| `Status` | Single select | pending, done, error |

#### Original Image Fields (Attachments)

| Field Name | Type | Description |
|------------|------|-------------|
| `original_headshot` | Attachment | Owner/staff headshot photo |
| `original_interior_1` | Attachment | Interior photo 1 |
| `original_interior_2` | Attachment | Interior photo 2 |
| `original_exterior` | Attachment | Exterior/storefront photo |
| `original_product_1` | Attachment | Product photo 1 (if has_products) |
| `original_product_2` | Attachment | Product photo 2 (if has_products) |

#### AI Enhanced Image Fields (AI - Gemini 3 Pro Image)

| Field Name | Type | Input Field | Prompt |
|------------|------|-------------|--------|
| `enhanced_headshot` | AI (Image) | `original_headshot` | Enhance this professional headshot photo. Improve lighting, color balance, and clarity while maintaining a natural look. Make it suitable for a business website hero section. |
| `enhanced_interior_1` | AI (Image) | `original_interior_1` | Enhance this interior photo of a business. Improve lighting, colors, and clarity. Make the space look inviting and professional for a website. |
| `enhanced_interior_2` | AI (Image) | `original_interior_2` | Enhance this interior photo of a business. Improve lighting, colors, and clarity. Make the space look inviting and professional for a website. |
| `enhanced_exterior` | AI (Image) | `original_exterior` | Enhance this exterior/storefront photo. Improve lighting, colors, and clarity. Make it look professional and inviting for a business website. |
| `enhanced_product_1` | AI (Image) | `original_product_1` | Enhance this product photo. Improve lighting, colors, and clarity. Make the product look appealing and professional for e-commerce display. |
| `enhanced_product_2` | AI (Image) | `original_product_2` | Enhance this product photo. Improve lighting, colors, and clarity. Make the product look appealing and professional for e-commerce display. |

#### AI Text Fields (AI - GPT-4.1 or Gemini)

| Field Name | Type | Convex Field | Prompt |
|------------|------|--------------|--------|
| `hero_headline` | AI (Long text) | `heroHeadline` | Based on the {business_name}, {business_type}, and {transcript} fields, write a compelling 5-10 word headline for the website hero section. Make it catchy and professional. |
| `hero_subheadline` | AI (Long text) | `heroSubHeadline` | Based on the {transcript} field, write a 1-sentence subheadline (15-25 words) that highlights the main value proposition or unique selling point of this business. |
| `about_content` | AI (Long text) | `aboutDescription` | Based on the {transcript} field, write a 2-3 paragraph about section (150-250 words) telling the business owner's story. Include their passion, experience, and what makes their business special. Write in third person. |
| `services_description` | AI (Long text) | `servicesDescription` | Based on the {transcript} field, list and briefly describe the main services or products this business offers. Format as a comma-separated list or short paragraph. Keep it concise (50-100 words). |
| `contact_cta` | AI (Long text) | `contactCta` | Write a short, friendly call-to-action (10-20 words) encouraging visitors to contact or visit this business. Consider the {business_type} when writing (e.g., "Book your appointment" for salon, "Visit us today" for retail). |

> **Note:** When creating AI text fields, use the "+ Insert field" button to properly reference fields like `{transcript}`, `{business_name}`, and `{business_type}`.

---

## Convex Schema

### submissions table

```typescript
submissions: defineTable({
  // Business info
  businessName: v.string(),
  businessType: v.string(),
  ownerName: v.string(),
  ownerPhone: v.string(),
  // ...

  // Media
  photos: v.optional(v.array(v.string())),
  hasProducts: v.optional(v.boolean()), // NEW: affects expected photo count
  transcript: v.optional(v.string()),

  // Airtable sync
  airtableRecordId: v.optional(v.string()),
  airtableSyncStatus: v.optional(v.string()), // pending_push, pushed, synced, error

  // DEPRECATED: kept for backwards compatibility
  enhancedImageUrl: v.optional(v.string()),
  enhancedImageStorageId: v.optional(v.id("_storage")),
  enhancedImageUrls: v.optional(v.array(v.string())),
  enhancedImageStorageIds: v.optional(v.array(v.id("_storage"))),
})
```

### websiteContent table

```typescript
websiteContent: defineTable({
  submissionId: v.optional(v.id("submissions")),

  // AI-generated text fields (from Airtable)
  heroHeadline: v.optional(v.string()),
  heroSubHeadline: v.optional(v.string()),
  aboutDescription: v.optional(v.string()),
  servicesDescription: v.optional(v.string()),
  contactCta: v.optional(v.string()),

  // Structured enhanced images (preserves field names)
  enhancedImages: v.optional(v.object({
    headshot: v.optional(v.object({
      url: v.optional(v.string()),
      storageId: v.optional(v.id("_storage")),
    })),
    interior_1: v.optional(v.object({ url, storageId })),
    interior_2: v.optional(v.object({ url, storageId })),
    exterior: v.optional(v.object({ url, storageId })),
    product_1: v.optional(v.object({ url, storageId })),
    product_2: v.optional(v.object({ url, storageId })),
  })),

  airtableSyncedAt: v.optional(v.number()),
})
```

---

## Field Mapping

### Airtable → Convex websiteContent

| Airtable Field | Convex Field |
|----------------|--------------|
| `hero_headline` | `heroHeadline` |
| `hero_subheadline` | `heroSubHeadline` |
| `about_content` | `aboutDescription` |
| `services_description` | `servicesDescription` |
| `contact_cta` | `contactCta` |
| `enhanced_headshot` | `enhancedImages.headshot` |
| `enhanced_interior_1` | `enhancedImages.interior_1` |
| `enhanced_interior_2` | `enhancedImages.interior_2` |
| `enhanced_exterior` | `enhancedImages.exterior` |
| `enhanced_product_1` | `enhancedImages.product_1` |
| `enhanced_product_2` | `enhancedImages.product_2` |

### Photo Index Convention

When photos are captured in the mobile app, they are stored as an array. The index determines the photo type:

| Array Index | Photo Type | Airtable Field |
|-------------|------------|----------------|
| `photos[0]` | Headshot | `original_headshot` |
| `photos[1]` | Interior 1 | `original_interior_1` |
| `photos[2]` | Interior 2 | `original_interior_2` |
| `photos[3]` | Exterior | `original_exterior` |
| `photos[4]` | Product 1 | `original_product_1` (if hasProducts) |
| `photos[5]` | Product 2 | `original_product_2` (if hasProducts) |

---

## Sync Process

### 1. Push to Airtable

When a submission is submitted (`submissions.submit`):

1. Set `airtableSyncStatus` to `"pending_push"`
2. Schedule `pushToAirtableInternal` action
3. Create Airtable record with:
   - Business info (name, type, owner)
   - Transcript (for AI text generation)
   - Original photos as attachments
   - `has_products` flag
4. Save `airtableRecordId` to submission
5. Set `airtableSyncStatus` to `"pushed"`
6. Schedule `fetchEnhancedContentWithRetry` after 30 seconds

### 2. Fetch Enhanced Content

The fetch action uses exponential backoff retry:

| Retry | Delay |
|-------|-------|
| 1 | 30 seconds |
| 2 | 1 minute |
| 3 | 2 minutes |
| 4 | 5 minutes |
| 5 | 10 minutes |

The fetch waits until:
- ALL expected enhanced images are ready
- ALL AI text fields are populated

### 3. Save to websiteContent

When all content is ready:

1. Download enhanced images from Airtable
2. Store images in Convex storage
3. Create/update `websiteContent` record with:
   - Structured enhanced images (preserving field names)
   - AI-generated text fields
4. Set submission `airtableSyncStatus` to `"synced"`
5. Update Airtable record `Status` to `"done"`

---

## Conditional Product Logic

If `hasProducts` is `false`:
- Only 4 photos are expected (headshot, interior_1, interior_2, exterior)
- Product fields are not sent to Airtable
- Fetch only waits for 4 enhanced images

Default: `hasProducts = true` for backwards compatibility.

---

## Environment Variables

Set these in Convex:

```bash
npx convex env set AIRTABLE_API_KEY "pat..."
npx convex env set AIRTABLE_BASE_ID "app..."
npx convex env set AIRTABLE_TABLE_ID "tbl..."
npx convex env set R2_PUBLIC_URL "https://pub-xxx.r2.dev"
```

---

## API Reference

### Actions

#### `pushToAirtable`
```typescript
// Push submission to Airtable (manual trigger)
const result = await ctx.runAction(api.airtable.pushToAirtable, {
  submissionId: "..."
});
```

#### `pullFromAirtable`
```typescript
// Manually trigger fetch of enhanced content
const result = await ctx.runAction(api.airtable.pullFromAirtable, {
  submissionId: "..."
});
```

### Queries

#### `getSyncStatus`
```typescript
// Check Airtable sync status
const status = await ctx.runQuery(api.airtable.getSyncStatus, {
  submissionId: "..."
});
// Returns: { airtableRecordId, syncStatus, hasWebsiteContent, websiteContentId, airtableSyncedAt }
```

#### `getEnhancedContent`
```typescript
// Get enhanced content from websiteContent
const content = await ctx.runQuery(api.airtable.getEnhancedContent, {
  submissionId: "..."
});
// Returns: { enhancedImages, heroHeadline, heroSubHeadline, aboutDescription, servicesDescription, contactCta, airtableSyncedAt }
```

---

## Troubleshooting

### Common Issues

1. **422 Error on Push**
   - Check that all Airtable field names match exactly
   - Verify field types (attachments need `[{ url: "..." }]` format)

2. **403 Error**
   - Update Airtable token with `data.records:write` scope

3. **Images not enhancing**
   - Verify AI fields have "Run automatically" enabled
   - Check that original images uploaded successfully

4. **Text fields empty**
   - Ensure `transcript` field has content
   - Verify AI text fields reference the correct input fields

5. **Schema validation error with existing data**
   - Old fields (`enhancedImageUrl`, etc.) kept as deprecated for backwards compatibility
   - New data goes to `websiteContent` table

### Checking Logs

View Convex logs for debug info:
```
npx convex logs
```

Look for:
- `[Airtable] Pushing submission...`
- `[Airtable Fetch] Expected X enhanced images, found Y`
- `[Airtable Fetch] AI text fields ready: true/false`

---

## Files Modified

| File | Changes |
|------|---------|
| `convex/schema.ts` | Added `hasProducts`, `enhancedImages` structure, AI text fields, kept deprecated fields |
| `convex/airtable.ts` | Added `fetchEnhancedContentWithRetry`, `saveEnhancedContent`, updated push with transcript/business_type |
| `convex/submissions.ts` | Added `hasProducts` to update mutation |
| `docs/airtable-integration.md` | This documentation file |
