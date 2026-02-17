# Devpatch 3 - February 17, 2026

## Schema Fixes

### Added missing fields to `submissions` table
- Added `airtableRecordId: v.optional(v.string())`
- Added `airtableSyncStatus: v.optional(v.string())`
- **Why:** Existing records had these fields from the Airtable integration, causing `npx convex dev` schema validation to fail.

### Added missing fields to `websiteContent` table
- Added `servicesDescription: v.optional(v.string())`
- Added `contactCta: v.optional(v.string())`
- Added `enhancedImages: v.optional(v.any())`
- Added `airtableSyncedAt: v.optional(v.number())`
- **Why:** Existing records had these fields, causing schema validation failure on deploy.

### Added database indexes for performance
- **creators:** `by_email`, `by_referral_code`
- **submissions:** `by_creator_status` (compound index on `creatorId` + `status`), `by_city`
- **generatedWebsites:** `by_status`
- **Why:** Convex queries without indexes scan the full table. These indexes optimize common query patterns (creator dashboard filtering, admin queue, geographic filtering).

---

## Bug Fixes

### Submission status now sets to "submitted" instead of "pending"
- **File:** `convex/submissions.ts`
- Changed the `submit` mutation to set `status: "submitted"` instead of `status: "pending"`.

### Dashboard and submissions list now show "Submitted" badge
- **Files:** `app/(app)/dashboard.tsx`, `app/(app)/submissions/index.tsx`
- Added `submitted` case to `getStatusBadge()` in both files.
- Submissions with `"submitted"` status now display a blue "Submitted" badge instead of falling through to the yellow "Pending" default.

### "Continue Submission" button no longer redirects to dashboard
- **File:** `app/(app)/submissions/[id].tsx`
- **Problem:** Clicking "Continue Submission" on a draft navigated to submit pages (photos/interview/review), but those pages load the submission ID from AsyncStorage. If `current_submission_id` wasn't set, the page redirected back to the dashboard.
- **Fix:** Replaced the `Link` component with a `TouchableOpacity` that sets `AsyncStorage.setItem('current_submission_id', submission._id)` before navigating.

### Video interview playback no longer appears zoomed on review page
- **File:** `app/(app)/submit/review.tsx`
- Changed video preview `resizeMode` from `ResizeMode.COVER` to `ResizeMode.CONTAIN`.
- `COVER` was cropping the video to fill the container, making it appear zoomed in. `CONTAIN` shows the full frame.

### Added `ownerEmail` to update mutation validator
- **File:** `convex/submissions.ts`
- Added `ownerEmail: v.optional(v.string())` to the `update` mutation args.
- **Why:** The `create` mutation included it but `update` didn't, causing a validation error when navigating back from the photos page.

---

## Phase 2 — Core Business Logic

### [Schema] Earnings & Withdrawals tables — P0

Added 3 new tables to `convex/schema.ts` for the creator payout flow:

**`earnings` table** — Tracks individual earning events per creator per submission.
- `creatorId: v.id("creators")` — which creator earned it
- `submissionId: v.id("submissions")` — which submission triggered it
- `amount: v.number()` — payout amount in PHP
- `type: v.union("submission_approved", "referral_bonus", "lead_bonus")` — earning source
- `status: v.union("pending", "available", "withdrawn")` — payout lifecycle
- `createdAt: v.number()` — timestamp
- Indexes: `by_creator`, `by_submission`

**`withdrawals` table** — Tracks payout requests from creators.
- `creatorId: v.id("creators")` — who is withdrawing
- `amount: v.number()` — withdrawal amount
- `payoutMethod: v.union("gcash", "maya", "bank_transfer")` — Philippine payout channels
- `accountDetails: v.string()` — account number/name
- `status: v.union("pending", "processing", "completed", "failed")` — withdrawal lifecycle
- `processedAt: v.optional(v.number())` — when admin processed it
- `transactionRef: v.optional(v.string())` — external transaction reference
- `createdAt: v.number()` — timestamp
- Indexes: `by_creator`, `by_status`

**`payoutMethods` table** — Stores saved payout methods per creator.
- `creatorId: v.id("creators")` — owner
- `type: v.union("gcash", "maya", "bank_transfer")` — method type
- `accountName: v.string()` — account holder name
- `accountNumber: v.string()` — account number
- `isDefault: v.boolean()` — whether this is the default method
- Index: `by_creator`

**Why:** This is the creator payout flow (GCash/Maya/bank transfer) — core to the business model. Creators earn from approved submissions, referral bonuses, and lead bonuses. They withdraw via Philippine payment channels.

---

### [Schema] Leads & CRM tables — P0

Added 2 new tables to `convex/schema.ts` for the leads system:

**`leads` table** — Tracks leads generated from deployed business websites.
- `submissionId: v.id("submissions")` — which business website generated the lead
- `creatorId: v.id("creators")` — which creator submitted the business
- `businessOwnerId: v.optional(v.string())` — future link to business owner account
- `source: v.union("website", "qr_code", "direct")` — how the lead came in
- `name: v.string()` — lead contact name
- `phone: v.string()` — lead phone number
- `email: v.optional(v.string())` — lead email
- `message: v.optional(v.string())` — lead's inquiry message
- `status: v.union("new", "contacted", "qualified", "converted", "lost")` — CRM pipeline stages
- `createdAt: v.number()` — timestamp
- Indexes: `by_submission`, `by_creator`, `by_status`

**`leadNotes` table** — Tracks notes/follow-ups on leads.
- `leadId: v.id("leads")` — which lead this note belongs to
- `creatorId: v.id("creators")` — who wrote the note
- `content: v.string()` — note content
- `createdAt: v.number()` — timestamp
- Index: `by_lead`

**Why:** Leads are the value proposition for business owners — their deployed website generates leads (via contact forms, QR codes, or direct links). The CRM pipeline lets creators/business owners track lead status from new through converted.

---

### [Schema] Consolidate websiteContent into generatedWebsites

Merged the `websiteContent` table fields into `generatedWebsites` to eliminate the redundant second table for website data. Previously, website HTML/CSS/deployment lived in `generatedWebsites` while AI-generated content (headlines, descriptions, enhanced images) lived in `websiteContent` — requiring two queries per submission and creating confusion about which table to use.

**Files changed:**

**`convex/schema.ts`**
- Added all `websiteContent` fields to `generatedWebsites` table:
  - Hero section: `heroTitle`, `heroSubtitle`, `heroHeadline`, `heroSubHeadline`, `heroBadgeText`, `heroCtaLabel`, `heroCtaLink`, `heroTestimonial`
  - About section: `aboutText`, `aboutDescription`, `aboutHeadline`, `aboutTagline`, `aboutTags`, `aboutContent`
  - Featured section: `featuredHeadline`, `featuredSubHeadline`, `featuredSubheadline`, `featuredImages`, `featuredProducts`
  - Footer/Navbar: `footerDescription`, `navbarHeadline`, `navbarCtaLabel`, `navbarCtaLink`, `navbarCtaText`, `navbarLinks`
  - Services: `servicesHeadline`, `servicesSubheadline`, `servicesDescription`
  - Contact: `contactCta`
  - Business info: `businessName`, `tagline`, `tone`
  - Content data: `services`, `images`, `contact`, `contactInfo`, `customizations`, `uniqueSellingPoints`, `visibility`, `socialLinks`
  - Enhanced images: `enhancedImages` (structured object with headshot, interior_1, interior_2, exterior, product_1, product_2 — each with `url` and `storageId`)
  - Tracking: `updatedAt`, `airtableSyncedAt`
- Kept `websiteContent` table definition marked as **DEPRECATED** — required for schema validation of existing data

**`convex/airtable.ts`** — Rewired the Airtable AI pipeline to use `generatedWebsites`:
- `saveEnhancedContent` mutation: now queries/inserts/patches `generatedWebsites` instead of `websiteContent`
- `getSyncStatus` query: reads `generatedWebsites` for content status instead of `websiteContent`
- `getEnhancedContent` query: reads from `generatedWebsites` instead of `websiteContent`
- Updated all log messages and comments

**`convex/generatedWebsites.ts`** — Extended CRUD operations:
- `create`: made `html` optional (content may arrive before HTML generation)
- `update`: added content fields (`heroTitle`, `heroSubtitle`, `heroHeadline`, `heroSubHeadline`, `aboutText`, `aboutDescription`, `aboutContent`, `businessName`, `tagline`, `servicesDescription`, `contactCta`) and auto-sets `updatedAt`

**`convex/websiteContent.ts`** — Marked as **DEPRECATED**:
- All functions have `console.warn` deprecation notices
- `getBySubmissionId` now tries `generatedWebsites` first, falls back to legacy `websiteContent` for old data
- Kept for backwards compatibility with the web app on the other branch

**Result:** Single table (`generatedWebsites`) now holds both website deployment data AND AI-generated content. One query per submission instead of two. The deprecated `websiteContent` table remains in schema for existing data and will be removed after data migration.
