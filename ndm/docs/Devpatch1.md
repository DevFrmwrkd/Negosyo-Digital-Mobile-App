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
==
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

---

## Phase 3 — Engagement & Trust

### [Schema + Backend + App] Push Notifications — P1

Added a full notification system with in-app storage and Expo push notification delivery.

**`convex/schema.ts`** — Added 2 new tables + 2 missing fields:

**`notifications` table** — Stores all in-app notifications per creator.
- `creatorId: v.id("creators")` — notification recipient
- `type: v.union("submission_approved", "submission_rejected", "new_lead", "payout_sent", "website_live", "system")` — event type
- `title: v.string()` — notification title
- `body: v.string()` — notification body text
- `data: v.optional(v.any())` — flexible payload for deep linking (submissionId, leadId, websiteUrl, amount, etc.)
- `read: v.boolean()` — read/unread state for badge count
- `sentAt: v.number()` — timestamp
- Indexes: `by_creator` (all notifications), `by_creator_unread` (compound index for fast unread count)

**`pushTokens` table** — Stores Expo/FCM push tokens per device.
- `creatorId: v.id("creators")` — token owner
- `token: v.string()` — Expo push token
- `platform: v.union("ios", "android", "web")` — device platform
- `active: v.boolean()` — deactivated when device unregisters or token is invalid
- Indexes: `by_creator` (all devices), `by_token` (dedup on registration)

**Added missing fields to `submissions` table:**
- `rejectionReason: v.optional(v.string())` — used by `admin.rejectSubmission` but was missing from schema
- `websiteUrl: v.optional(v.string())` — used by `admin.markDeployed` and `admin.markWebsiteGenerated` but was missing

**`convex/notifications.ts`** — New file with full notification backend:

*Internal mutations:*
- `createAndSend` — Creates notification record in DB + schedules push delivery. Called by admin mutations and future event handlers.

*Push notification delivery:*
- `sendPushNotification` — Internal action that fetches active push tokens for the creator, sends via Expo Push API (`https://exp.host/--/api/v2/push/send`), and auto-deactivates tokens that return `DeviceNotRegistered`.

*Token management:*
- `registerPushToken` — Public mutation called by the app on launch. Upserts token (dedup by token string, reactivates if exists).
- `removePushToken` — Public mutation called on logout. Deactivates the token.
- `getActiveTokens` — Internal query for push delivery.
- `deactivateToken` — Internal mutation for invalid token cleanup.

*Public queries:*
- `getByCreator` — All notifications for a creator, newest first
- `getUnreadCount` — Fast unread badge count using compound index
- `markAsRead` — Mark single notification as read
- `markAllAsRead` — Mark all unread notifications as read

**`convex/admin.ts`** — Wired notifications into all admin status changes:

| Admin Action | Notification Type | When |
|---|---|---|
| `approveSubmission` | `submission_approved` | After status → "approved" |
| `rejectSubmission` | `submission_rejected` | After status → "rejected" (includes reason in body) |
| `markDeployed` | `website_live` | After status → "deployed" (includes websiteUrl in data) |
| `markPaid` | `payout_sent` | After status → "paid" (includes amount in data) |

Each notification includes the `submissionId` in `data` for deep linking. The `markWebsiteGenerated` step does NOT send a notification (intermediate state before deploy).

**How it works end-to-end:**
1. Admin triggers action (e.g., approves submission)
2. Mutation updates submission status
3. `ctx.scheduler.runAfter(0, internal.notifications.createAndSend, ...)` — schedules notification creation
4. `createAndSend` inserts notification into DB (instant in-app visibility via Convex reactivity)
5. `createAndSend` schedules `sendPushNotification` action
6. `sendPushNotification` fetches active tokens → sends via Expo Push API → auto-cleans invalid tokens

**App integration required:**
- Call `notifications.registerPushToken` on app launch (after getting Expo push token)
- Call `notifications.removePushToken` on logout
- Use `notifications.getByCreator` to render notification list
- Use `notifications.getUnreadCount` for badge on bell icon
- `new_lead` notifications will be wired in when leads CRUD is implemented

### [App] Push Notification Registration & Notifications Screen — P1

Integrated push notifications and an in-app notifications UI into the mobile app.

**`hooks/usePushNotifications.ts`** — New hook for Expo push token registration:
- Configures foreground notification handler (`shouldShowAlert`, `shouldPlaySound`, `shouldSetBadge`)
- On mount (if `creatorId` exists): checks `Device.isDevice`, requests permissions, creates Android notification channel
- Gets Expo push token using project ID `2adbda2f-fecd-4fdd-91b8-56db76e0c780`
- Calls `api.notifications.registerPushToken` to save token in Convex
- Uses `useRef` guard to prevent duplicate registrations

**`app/(app)/notifications.tsx`** — New notifications screen:
- Back button + "Mark all read" action (only visible when unread count > 0)
- Color-coded icons: emerald (approved/payout), red (rejected), blue (new lead), purple (website live), zinc (system)
- `timeAgo()` helper: "Just now" / "5m ago" / "2h ago" / "3d ago" / full date
- Tapping notification: marks as read + deep links to submission detail (if `data.submissionId` exists)
- Unread state: green tint background + green dot indicator
- Empty state with `notifications-off-outline` icon

**`app/(app)/dashboard.tsx`** — Added notification bell + push registration:
- Imported `usePushNotifications` hook, called with `creator?._id`
- Added `unreadCount` query from `api.notifications.getUnreadCount`
- Bell icon (`notifications-outline`) in header, navigates to `/(app)/notifications`
- Red badge with white text shows unread count (caps at "99+")

**`app.json`** — Added `expo-notifications` plugin with icon and green accent color (`#10b981`)

**`package.json`** — Added `expo-notifications: ~0.32.16` and `expo-device: ~8.0.10`

**Note:** Requires APK rebuild for native `expo-notifications` module to be bundled.

---

### [Schema + Backend] Audit Logs — P1

Added an audit trail system to track all admin actions for accountability and debugging.

**`convex/schema.ts`** — Added `auditLogs` table:
- `adminId: v.string()` — Clerk user ID of the admin performing the action
- `action: v.union(...)` — 8 action types:
  - `submission_approved`, `submission_rejected` — review decisions
  - `website_generated`, `website_deployed` — deployment pipeline
  - `payment_sent` — financial actions
  - `submission_deleted`, `creator_updated`, `manual_override` — future admin actions
- `targetType: v.union("submission", "creator", "website", "withdrawal")` — what was affected
- `targetId: v.string()` — ID of the affected record
- `metadata: v.optional(v.any())` — additional context (reason, old/new values, business name, amount, etc.)
- `timestamp: v.number()` — when the action occurred
- Indexes: `by_admin`, `by_target` (compound: targetType + targetId), `by_action`, `by_timestamp`

**`convex/auditLogs.ts`** — New file with audit log CRUD:

*Internal mutation:*
- `log` — Called by admin mutations via `ctx.scheduler.runAfter(0, ...)`. Inserts an audit record with all context.

*Public queries (for admin dashboard):*
- `getByTarget(targetType, targetId)` — Full audit history for a specific submission/creator/website/withdrawal
- `getRecent(limit?)` — Most recent audit entries (default 50), for admin activity feed
- `getByAdmin(adminId, limit?)` — All actions by a specific admin

**`convex/admin.ts`** — Wired audit logging into all 5 admin mutations:

| Mutation | Audit Action | Metadata Captured |
|---|---|---|
| `approveSubmission` | `submission_approved` | businessName, previousStatus |
| `rejectSubmission` | `submission_rejected` | businessName, reason, previousStatus |
| `markWebsiteGenerated` | `website_generated` | businessName, websiteUrl |
| `markDeployed` | `website_deployed` | businessName, websiteUrl |
| `markPaid` | `payment_sent` | businessName, amount, creatorId |

**Breaking change:** All admin mutations now require an `adminId: v.string()` argument. The admin dashboard must pass the Clerk user ID when calling these mutations.

**How it works:**
1. Admin triggers action (e.g., approves submission) — passes their Clerk `userId` as `adminId`
2. Mutation performs the status change
3. `ctx.scheduler.runAfter(0, internal.auditLogs.log, ...)` creates the audit record asynchronously
4. Audit records can be queried per target (submission history), per admin (accountability), or globally (activity feed)

---

### [Schema + Backend + App] Referral System — P2

Added a complete referral tracking system to drive organic growth through word-of-mouth.

**`convex/schema.ts`** — Changes:

*Added `referredByCode` field to `creators` table:*
- `referredByCode: v.optional(v.string())` — the referral code used during signup

*Added `referrals` table:*
- `referrerId: v.id("creators")` — creator who shared the referral code
- `referredId: v.id("creators")` — creator who signed up with the code
- `referralCode: v.string()` — the code that was used
- `status: v.union("pending", "qualified", "paid")` — lifecycle:
  - `pending` — referred user signed up but no approved submission yet
  - `qualified` — referred user's first submission was approved (bonus credited)
  - `paid` — bonus has been withdrawn (future use)
- `bonusAmount: v.optional(v.number())` — bonus in PHP, set when qualified
- `qualifiedAt: v.optional(v.number())` — when referral qualified
- `paidAt: v.optional(v.number())` — when bonus was withdrawn
- `createdAt: v.number()` — when the referral was created
- Indexes: `by_referrer`, `by_referred`, `by_status`

**`convex/referrals.ts`** — New file with referral CRUD:

*Internal mutations:*
- `createFromSignup` — Called when a new creator signs up with a referral code. Deduplicates by `referredId`. Creates a `pending` referral record linking referrer → referred.
- `qualifyByCreator` — Called when a referred creator's first submission is approved. Marks referral as `qualified`, creates a `referral_bonus` earning for the referrer, updates referrer's balance and totalEarnings, and sends a notification.

*Public queries:*
- `getByReferrer(referrerId)` — All referrals made by a creator, enriched with referred creator names
- `getStats(referrerId)` — Dashboard stats: total, pending, qualified, paid counts + total earned

**`convex/creators.ts`** — Updated create mutation:
- Added `referredByCode: v.optional(v.string())` argument
- On signup, if `referredByCode` is provided: looks up the referrer via `by_referral_code` index, creates a referral record via `ctx.scheduler.runAfter(0, internal.referrals.createFromSignup, ...)`
- Self-referral protection: skips if `referrer._id === creatorId`

**`convex/admin.ts`** — Updated `approveSubmission`:
- After approving, checks if the creator was referred (queries `referrals` by `by_referred` index)
- If a `pending` referral exists and this is the creator's first approved submission, schedules `internal.referrals.qualifyByCreator` with a ₱100 bonus amount
- The bonus amount is hardcoded at ₱100 for now — can be made configurable later

**`app/(auth)/signup.tsx`** — Added referral code input:
- New `referredByCode` state variable
- New text input field after "Confirm Password" with gift icon, auto-capitalizes, labeled "Optional"
- Passed to `createCreator({ ..., referredByCode })` during email verification

**End-to-end flow:**
1. Creator A shares their referral code (e.g., `JUA8K3MN`) with Creator B
2. Creator B enters the code during signup → `creators.create` stores `referredByCode` and creates a `pending` referral record
3. Creator B submits a business → admin approves it
4. `approveSubmission` detects this is Creator B's first approval and a pending referral exists
5. `qualifyByCreator` marks referral as `qualified`, credits ₱100 to Creator A's balance, creates an earning record, and sends a push notification

**Note:** Referral code input is only available on email signup. OAuth (Google) users can be supported later via a profile settings screen or deep link parameters.

---

### [Schema + Backend] Analytics — P2

Added analytics tables for tracking creator performance and website engagement metrics.

**`convex/schema.ts`** — Added 2 new tables:

**`analytics` table** — Aggregated creator performance stats per period.
- `creatorId: v.id("creators")` — which creator
- `period: v.string()` — period key: `"2026-02"` for monthly, `"2026-02-17"` for daily
- `periodType: v.union("daily", "monthly")` — granularity
- `submissionsCount: v.number()` — total submissions in period
- `approvedCount: v.number()` — approved submissions
- `rejectedCount: v.number()` — rejected submissions
- `leadsGenerated: v.number()` — leads from this creator's websites
- `earningsTotal: v.number()` — total earnings in PHP
- `websitesLive: v.number()` — deployed websites
- `referralsCount: v.number()` — referrals made
- `updatedAt: v.number()` — last update timestamp
- Indexes: `by_creator_period` (compound: creatorId + periodType + period), `by_period` (periodType + period for platform-wide aggregation)

**`websiteAnalytics` table** — Daily engagement stats per deployed website.
- `submissionId: v.id("submissions")` — which website
- `date: v.string()` — date key `"2026-02-17"`
- `pageViews: v.number()` — total page views
- `uniqueVisitors: v.number()` — unique visitors
- `contactClicks: v.number()` — contact button clicks
- `whatsappClicks: v.number()` — WhatsApp button clicks
- `phoneClicks: v.number()` — phone number clicks
- `formSubmissions: v.number()` — contact form submissions
- `updatedAt: v.number()` — last update timestamp
- Indexes: `by_submission_date` (compound: submissionId + date), `by_date` (for admin daily overview)

**`convex/analytics.ts`** — New file with analytics CRUD:

*Internal mutations (for event tracking and scheduled aggregation):*
- `upsertCreatorStats(creatorId, period, periodType, stats)` — Create or update a creator's analytics record for a period
- `incrementStat(creatorId, period, periodType, field, delta)` — Increment a single stat field (for real-time event-driven updates)
- `upsertWebsiteStats(submissionId, date, stats)` — Create or update website analytics for a date

*Public queries:*
- `getCreatorStats(creatorId, periodType, fromPeriod?, toPeriod?)` — Creator's analytics over a date range (for creator dashboard charts)
- `getPlatformStats(periodType, period)` — Platform-wide aggregated stats for a period (for admin dashboard)
- `getWebsiteStats(submissionId, fromDate?, toDate?)` — Website daily stats + totals (for website performance view)
- `getWebsiteStatsByDate(date)` — All website stats for a specific date (admin daily overview)

*Helpers:*
- `getTodayString()` — Returns `"YYYY-MM-DD"` for today
- `getCurrentMonthString()` — Returns `"YYYY-MM"` for current month

**Wired into admin mutations (`convex/admin.ts`):**
- `approveSubmission` → increments `approvedCount` (daily + monthly)
- `rejectSubmission` → increments `rejectedCount` (daily + monthly)
- `markDeployed` → increments `websitesLive` (daily + monthly)
- `markPaid` → increments `earningsTotal` by `creatorPayout` amount (daily + monthly)

**Wired into submissions (`convex/submissions.ts`):**
- `submit` → increments `submissionsCount` (daily + monthly) when a draft is submitted

**Scheduled aggregation (`convex/crons.ts` + `convex/analyticsJobs.ts`):**
- Daily cron runs at midnight UTC
- `aggregateDailyToMonthly` — Rolls up yesterday's daily stats into the corresponding monthly record via `upsertCreatorStats`
- `getDailyRecords` — Internal query to fetch all daily analytics for a given date

**Remaining integration:**
- Integrate Cloudflare Analytics API or Plausible for website traffic data
- Website click tracking via event listeners on deployed websites → API endpoint → `upsertWebsiteStats`

---

## Phase 4 — Schema Completeness & Backend CRUD

### [Schema] Enhanced creators table fields

Added missing fields for gamification, withdrawal tracking, and activity timestamps:
- `totalWithdrawn: v.optional(v.number())` — lifetime total withdrawn
- `submissionCount: v.optional(v.number())` — total submissions created (incremented on `submissions.create`)
- `level: v.optional(v.number())` — gamification level (1 = starter, 2 = active, 3 = pro, etc.)
- `updatedAt: v.optional(v.number())` — last profile update timestamp
- `lastActiveAt: v.optional(v.number())` — last activity timestamp (set on submission create)
- Added `by_status` index on `status` field

### [Schema] Enhanced submissions table fields

Added missing fields for richer business data, admin review tracking, and AI content:
- `businessDescription: v.optional(v.string())` — AI-generated description from transcript
- `province: v.optional(v.string())` — province (Philippine address)
- `barangay: v.optional(v.string())` — barangay (Philippine address)
- `postalCode: v.optional(v.string())` — postal code
- `coordinates: v.optional(v.object({ lat, lng }))` — GPS location of the business
- `aiGeneratedContent: v.optional(v.any())` — AI-extracted content from transcript (services, USPs, etc.)
- `reviewedBy: v.optional(v.string())` — Admin Clerk ID who approved/rejected
- `reviewedAt: v.optional(v.number())` — Timestamp of the review
- `platformFee: v.optional(v.number())` — Platform fee charged to business owner

### [Schema] Enhanced generatedWebsites table fields

Added domain customization fields:
- `subdomain: v.optional(v.string())` — e.g., `juans-bakery` for `juans-bakery.negosyo.digital`
- `customDomain: v.optional(v.string())` — e.g., `www.juansbakery.com`

### [Schema + Backend] Settings table — P3

Added `settings` table for platform-wide configurable values.

**`convex/schema.ts`** — Added `settings` table:
- `key: v.string()` — unique setting key (e.g., `"referral_bonus_amount"`, `"min_withdrawal"`, `"platform_fee_percent"`)
- `value: v.any()` — setting value (number, string, boolean, object)
- `description: v.optional(v.string())` — human-readable description
- `updatedAt: v.number()` — last update timestamp
- `updatedBy: v.optional(v.string())` — admin Clerk ID who last updated
- Index: `by_key`

**`convex/settings.ts`** — New file with settings CRUD:
- `get(key)` — Get a single setting by key (returns value or null)
- `getAll()` — Get all settings as a key-value map
- `set(key, value, description?, adminId?)` — Upsert a setting
- `remove(key)` — Delete a setting

### [Backend] Leads & Lead Notes CRUD — P0

**`convex/leads.ts`** — New file with full leads backend:

*Mutations:*
- `create(submissionId, creatorId, source, name, phone, email?, message?)` — Creates a lead, increments `leadsGenerated` analytics (daily + monthly), and sends `new_lead` notification to creator
- `updateStatus(id, status)` — Move lead through pipeline (new → contacted → qualified → converted / lost)
- `remove(id)` — Delete lead and all associated notes

*Queries:*
- `getBySubmission(submissionId)` — All leads for a business website
- `getByCreator(creatorId)` — All leads across all of a creator's businesses
- `getByStatus(status)` — Filter leads by pipeline stage
- `getCountBySubmission(submissionId)` — Lead count breakdown by status (for dashboard widgets)

**`convex/leadNotes.ts`** — New file:
- `create(leadId, creatorId, content)` — Add a follow-up note
- `getByLead(leadId)` — All notes for a lead (newest first)
- `remove(id)` — Delete a note

### [Backend] Earnings CRUD — P0

**`convex/earnings.ts`** — New file with earning record management:

*Internal mutations:*
- `create(creatorId, submissionId, amount, type, status?)` — Create an earning record. Called by `admin.markPaid` and `referrals.qualifyByCreator`. Defaults to `status: "available"`.
- `markWithdrawn(earningIds)` — Batch mark earnings as withdrawn (for withdrawal flow)

*Queries:*
- `getByCreator(creatorId)` — All earnings with business names (for transaction history)
- `getBySubmission(submissionId)` — Earnings tied to a specific submission
- `getSummary(creatorId)` — Aggregated earnings: total, available, pending, withdrawn, and breakdown by type (submissions/referrals/leads)

**Wiring:** `admin.markPaid` now calls `internal.earnings.create` with `type: "submission_approved"` when a payout is credited. It also updates `totalEarnings` on the creator record.

### [Backend] Withdrawals CRUD — P0

**`convex/withdrawals.ts`** — New file with full withdrawal flow:

*Mutations:*
- `create(creatorId, amount, payoutMethod, accountDetails)` — Request a withdrawal. Validates ₱100 minimum and sufficient balance. Deducts balance immediately (optimistic).
- `updateStatus(id, status, transactionRef?, adminId)` — Admin updates withdrawal status:
  - `"processing"` → marks as being processed
  - `"completed"` → sets `processedAt`, increments `totalWithdrawn` on creator, sends notification
  - `"failed"` → restores creator's balance
  - Creates audit log for all status changes

*Queries:*
- `getByCreator(creatorId)` — All withdrawals for a creator
- `getByStatus(status)` — Admin withdrawal queue (enriched with creator name/email)
- `getAll()` — All withdrawals with creator names

### [Backend] Payout Methods CRUD — P0

**`convex/payoutMethods.ts`** — New file with saved payment methods:

*Mutations:*
- `save(creatorId, type, accountName, accountNumber, isDefault?)` — Save a new payout method. First method auto-sets as default. Setting `isDefault` unsets previous default.
- `update(id, accountName?, accountNumber?)` — Update account details
- `setDefault(id)` — Set a method as the default
- `remove(id)` — Delete a method. If default is deleted, next available method becomes default.

*Queries:*
- `getByCreator(creatorId)` — All saved methods for a creator
- `getDefault(creatorId)` — The default payout method (or null)

### [Backend] Admin review tracking

Updated `convex/admin.ts`:
- `approveSubmission` now sets `reviewedBy: adminId` and `reviewedAt: Date.now()` on the submission
- `rejectSubmission` now sets `reviewedBy: adminId` and `reviewedAt: Date.now()` on the submission
- `markPaid` now creates an earning record via `internal.earnings.create` and updates `totalEarnings` on the creator

### [Backend] Submissions enhancements

Updated `convex/submissions.ts`:
- `create` mutation now accepts `province`, `barangay`, `postalCode`, `coordinates` optional fields
- `create` now increments `submissionCount` on the creator and sets `lastActiveAt`
- `update` mutation now accepts `businessDescription`, `province`, `barangay`, `postalCode`, `coordinates`, `platformFee`

---

## Phase 5 — Creator Onboarding, Certification & UX Improvements

### [App] Profile Image Upload to Cloudflare R2

Added profile photo upload functionality via Cloudflare R2.

**Files changed:**
- `app/(app)/edit-profile.tsx` — Added camera icon overlay, `ImagePicker` integration, uploads to R2 via presigned URL, calls `api.creators.update` with `profileImage` URL
- `convex/creators.ts` — `update` mutation now accepts `profileImage: v.optional(v.string())`
- `convex/schema.ts` — Added `profileImage: v.optional(v.string())` to creators table

### [App] Dashboard Profile Image Display

- `app/(app)/(tabs)/index.tsx` — Dashboard header shows creator's profile image (from R2 URL) instead of default avatar icon

### [App] Notification System Expansion

Added two new notification types to the schema:
- `submission_created` — triggered when a creator starts a new submission
- `profile_updated` — triggered when a creator updates their profile

**Files changed:**
- `convex/schema.ts` — Added `"submission_created"` and `"profile_updated"` to notification type union
- `convex/notifications.ts` — Updated type validators to include new types
- `convex/creators.ts` — `update` mutation now sends `profile_updated` notification via `ctx.scheduler.runAfter`

### [App] Empty State Rendering Fix (Android)

- **Problem:** Empty state containers with `borderStyle: 'dashed'` crashed on Android
- **Fix:** Replaced NativeWind `border-dashed` class with inline `style={{ borderStyle: 'dashed' }}` across all empty state views
- **Files:** `app/(app)/(tabs)/index.tsx`, `app/(app)/submissions/index.tsx`, `app/(app)/notifications.tsx`

### [App] Welcome / Onboarding Screen

Created a welcome screen for new (uncertified) creators.

**`app/(app)/onboarding.tsx`** — New screen with:
- App logo and "Welcome to Negosyo Digital" greeting
- Creator's first name display
- 3 animated feature cards (Submit, Deploy, Earn) with stagger entrance
- "Start Creator Training" button → navigates to certification training

**Routing:** Dashboard (`index.tsx`) redirects uncertified creators (no `certifiedAt`) to `/(app)/onboarding`

### [App] Creator Certification Training

Built a multi-screen training flow that creators must complete before accessing the dashboard.

**`app/(app)/training.tsx`** — Training intro screen:
- Hero section with graduation cap icon
- 5 training module cards (Lighting, Audio, Portrait, Interview Questions, Requirements)
- Each card shows module name, description, and estimated time
- "Start Training" button → navigates to lessons

**`app/(app)/training-lessons.tsx`** — Interactive lessons screen:
- 5 accordion-style lesson sections with expand/collapse animation (`LayoutAnimation`)
- Each lesson contains 2-5 best practice tips
- Progress tracking: lessons marked complete when expanded and viewed
- "Start Certification Quiz" button (enabled only after all 5 lessons viewed) → navigates to quiz

### [App] Certification Quiz

**`app/(app)/certification-quiz.tsx`** — Full quiz screen with:
- 5 multiple-choice questions covering all training modules
- Slide animation between questions with progress indicator
- Pass requirement: 4/5 correct answers (80%)
- **Pass screen:** Checkmark animation, congratulations message, score badge, certificate card, "Go to Dashboard" button, share button in header, "Download Certificate" link
- **Fail screen:** Graduation cap icon, "Not quite there yet!" message, score bar with percentage, "Try Again" button → navigates to `/(app)/training`

**`convex/creators.ts`** — Added `certify` mutation:
- Sets `certifiedAt: Date.now()` and `lastActiveAt: Date.now()` on the creator record
- Sends congratulatory system notification via `ctx.scheduler.runAfter`

### [App + Component] Certificate Card & Download/Share

Created a shared certificate card component and integrated download/share functionality.

**`components/CertificateCard.tsx`** — Shared component with `forwardRef<View>`:
- Green top banner (#15803d) with app icon + "NEGOSYO DIGITAL"
- Ribbon icon in light green circle
- "CERTIFICATE OF COMPLETION" label
- "Certified Creator" title with green accent divider
- Dark blue name badge (#1e3a5f) with creator name
- Body text about Local Business Digitization proficiency
- DATE ISSUED section with month/year
- Green bottom banner with "You can now start earning!"
- Props: `creatorName`, `certMonth`, `certYear`
- Uses `collapsable={false}` for Android `react-native-view-shot` compatibility

**Certificate download (both quiz success + profile settings):**
- Uses `react-native-view-shot` (`captureRef`) to capture certificate as PNG
- Uses `expo-media-library` (`saveToLibraryAsync`) to save directly to device gallery
- Bypasses `MediaLibrary.requestPermissionsAsync()` (crashes on Android 13+ requesting undeclared AUDIO permission)
- Instead uses `PermissionsAndroid.request(WRITE_EXTERNAL_STORAGE)` for Android < 13, and no permission needed for Android 13+ (MediaStore write access is granted by default)

**Certificate share:**
- Uses `expo-sharing` (`shareAsync`) with PNG mime type to open system share sheet

**`app/(app)/(tabs)/profile.tsx`** — Added "Show My Certificate" menu item:
- Only visible if creator is certified (`certifiedAt` exists)
- Opens full-screen Modal with certificate card
- "Save to Gallery" and "Share Certificate" buttons

**Dependencies added:**
- `react-native-view-shot` 4.0.3
- `expo-media-library` ~18.2.1

**`app.json`** — Added:
- `expo-media-library` plugin with `photosPermission`, `savePhotosPermission`, `isAccessMediaLocationEnabled`
- `android.permission.READ_MEDIA_IMAGES` permission for Android 13+

### [Schema] Removed `level` field from creators table

- Removed `level: v.optional(v.number())` from `convex/schema.ts`
- **Why:** Placeholder gamification field with no logic anywhere in the codebase. Can be re-added if/when gamification is implemented.

### [Backend] `lastActiveAt` Tracking

Previously `lastActiveAt` was only set when creating a submission. Now it's set in multiple places:

**`convex/creators.ts`:**
- `create` mutation — Sets `lastActiveAt` on new creator insert AND patches it for existing creators on every login (the `create` mutation is called on every app open for existing users via `index.tsx` auto-create)
- `certify` mutation — Sets `lastActiveAt` alongside `certifiedAt`
- `updateLastActive` mutation (new) — Dedicated mutation that looks up creator by Clerk ID and patches `lastActiveAt`

**`app/(app)/_layout.tsx`:**
- Added `useEffect` that calls `updateLastActive` when authenticated layout mounts with valid `userId`
- Serves as a backup mechanism for tracking activity

### [Backend] Notification Types Update

Added `"password_changed"` to the notification type union in `convex/schema.ts` for future password change notifications.
