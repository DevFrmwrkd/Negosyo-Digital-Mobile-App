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
