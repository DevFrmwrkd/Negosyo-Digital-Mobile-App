# Dev-Testing — Negosyo Digital Mobile

This file lists all features and changes that need to be tested on the **mobile app** and the **admin side** (Convex dashboard / future admin panel). Each section maps to changes documented in `Devpatch1.md`.

---

## How to Use This File

- [ ] = Not tested
- [x] = Tested and passed
- [!] = Tested and failed (add notes)

**Prerequisites:**
- Rebuild APK after adding `expo-notifications` and `expo-device` native modules
- Run `npx convex dev` to deploy schema changes before testing
- Test on a **physical Android device** (push notifications don't work on emulator)

---

## Mobile App Tests

### 1. Submission Flow — Basic

- [ ] Create a new submission with all required fields (business name, type, owner info, address, city)
- [ ] Submission status is set to `"draft"` on create
- [ ] Navigate to photos page — upload 3+ photos
- [ ] Navigate back to photos page — see "Photos Already Uploaded" notice, no re-upload on pressing "Next"
- [ ] Navigate back to photos, click "Add More Photos", add new photo — only new photo uploads on save
- [ ] Navigate back to photos, remove an existing photo — remaining photos saved without re-uploading kept ones
- [ ] Record video or audio interview
- [ ] Review page shows all data correctly, video plays without zoom (CONTAIN mode)
- [ ] Submit — status changes to `"submitted"`
- [ ] Dashboard shows "Submitted" badge (blue) for the new submission

### 2. Submission Flow — Edge Cases

- [ ] Clicking "Continue Submission" on a draft sets AsyncStorage `current_submission_id` and navigates correctly
- [ ] Photos page redirects to dashboard if no `current_submission_id` in AsyncStorage
- [ ] Bottom buttons on ALL submit screens (info, photos, interview, review) don't overlap with Android navigation bar/gesture area
- [ ] Test on a device with gesture navigation (no physical buttons) — buttons should have proper bottom padding
- [ ] `ownerEmail` field persists when navigating back from photos page (no validation error)

### 3. Dashboard

- [ ] Dashboard loads with creator name ("Mabuhay, [Name]!")
- [ ] Balance card shows ₱0.00 for new creators
- [ ] Recent submissions list shows up to 3 submissions with correct status badges
- [ ] Empty state shows "No submissions yet." when no submissions exist
- [ ] "Add Submission" floating button navigates to submit/info
- [ ] Logout button works — redirects to login screen

### 4. Notifications — In-App

- [ ] Bell icon visible on dashboard header (next to logout)
- [ ] Bell icon shows NO badge when unread count is 0
- [ ] Tapping bell navigates to notifications screen
- [ ] Notifications screen shows "No notifications yet" when empty
- [ ] Back button on notifications screen navigates back to dashboard

### 5. Notifications — Push (Requires APK Rebuild + Physical Device)

- [ ] On first app launch after login, push notification permission is requested
- [ ] After granting permission, `pushTokens` table in Convex has a new record with correct `creatorId`, `token`, `platform`
- [ ] Push token is NOT re-registered on subsequent app launches (dedup via `useRef`)
- [ ] When admin approves a submission → push notification appears in device notification tray
- [ ] When admin rejects a submission → push notification appears with rejection reason
- [ ] When admin deploys a website → push notification with "Website is Live!"
- [ ] When admin marks payment → push notification with amount
- [ ] Tapping a push notification while app is in foreground → notification still shows (foreground handler configured)
- [ ] After receiving push, in-app notification list updates in real-time (Convex reactivity)

### 6. Notifications — Interaction

- [ ] Tapping an unread notification marks it as read (green tint disappears, green dot gone)
- [ ] Tapping a notification with `submissionId` in data → deep links to submission detail page
- [ ] "Mark all read" button appears when unread count > 0
- [ ] "Mark all read" button disappears after tapping it
- [ ] Unread badge on dashboard bell updates in real-time after marking as read
- [ ] Badge caps at "99+" when unread count > 99

### 7. Signup — Basic

- [ ] Signup with email, first name, last name, password works
- [ ] Email verification code flow works
- [ ] Creator profile is created in Convex with correct fields
- [ ] Google OAuth signup works — auto-creates creator profile on dashboard load
- [ ] Referral code is generated on signup (format: 2 chars first name + 1 char last name + 6 random alphanumeric)

### 8. Signup — Referral Code

- [ ] Referral code input field is visible on signup form (after confirm password, labeled "Optional")
- [ ] Input auto-capitalizes text as you type
- [ ] Signing up WITHOUT a referral code works normally — no referral record created
- [ ] Signing up WITH a valid referral code → `referrals` table has new record with status `"pending"`
- [ ] Signing up WITH a valid referral code → `creators` table has `referredByCode` field set
- [ ] Signing up WITH a nonexistent referral code → signup succeeds (no error), no referral record created
- [ ] Signing up WITH your own referral code → no referral record created (self-referral protection)
- [ ] Signing up twice with same referral code → only one referral record (dedup by `referredId`)

### 9. Referral Bonus Flow (End-to-End)

- [ ] Creator A signs up → gets a referral code
- [ ] Creator B signs up with Creator A's referral code → `referrals` record created with status `"pending"`
- [ ] Creator B submits a business → admin approves it
- [ ] Referral status changes from `"pending"` to `"qualified"` in `referrals` table
- [ ] `earnings` table has a new `"referral_bonus"` record for Creator A with ₱100
- [ ] Creator A's `balance` increases by ₱100
- [ ] Creator A's `totalEarnings` increases by ₱100
- [ ] Creator A receives a push notification: "Referral Bonus Earned!"
- [ ] Creator B submits a second business → admin approves it → NO second referral bonus (only first approval triggers it)

---

## Admin Side Tests (Convex Dashboard / Future Admin Panel)

> **Note:** No admin UI exists in this repo yet. Test these via the Convex dashboard's "Functions" tab by manually calling mutations, or via the Convex CLI.

### 10. Submission Management

- [ ] `admin.approveSubmission({ id, adminId })` — changes status to `"approved"`
- [ ] `admin.rejectSubmission({ id, reason, adminId })` — changes status to `"rejected"`, sets `rejectionReason`
- [ ] `admin.markWebsiteGenerated({ id, websiteUrl, adminId })` — changes status to `"website_generated"`, sets `websiteUrl`
- [ ] `admin.markDeployed({ id, websiteUrl, adminId })` — changes status to `"deployed"`, sets `websiteUrl`
- [ ] `admin.markPaid({ id, adminId })` — changes status to `"paid"`, adds `creatorPayout` to creator's `balance`
- [ ] `admin.getAllSubmissionsWithCreators()` — returns all submissions with creator data attached

### 11. Notifications — Triggered by Admin Actions

- [ ] Approving → creates `submission_approved` notification in `notifications` table
- [ ] Rejecting → creates `submission_rejected` notification with reason in body
- [ ] Deploying → creates `website_live` notification with `websiteUrl` in data
- [ ] Marking paid → creates `payout_sent` notification with amount in data
- [ ] Generating website (`markWebsiteGenerated`) → does NOT create a notification (correct behavior)

### 12. Audit Logs

- [ ] Approving → creates audit log with action `"submission_approved"`, metadata has `businessName` and `previousStatus`
- [ ] Rejecting → creates audit log with action `"submission_rejected"`, metadata has `businessName`, `reason`, `previousStatus`
- [ ] Generating website → creates audit log with action `"website_generated"`, metadata has `websiteUrl`
- [ ] Deploying → creates audit log with action `"website_deployed"`, metadata has `websiteUrl`
- [ ] Marking paid → creates audit log with action `"payment_sent"`, metadata has `amount`, `creatorId`
- [ ] `auditLogs.getRecent()` → returns most recent 50 audit entries in descending order
- [ ] `auditLogs.getByTarget("submission", submissionId)` → returns full audit history for that submission
- [ ] `auditLogs.getByAdmin(adminClerkId)` → returns all actions by that admin
- [ ] All audit logs have correct `adminId` matching the Clerk user ID passed in

### 13. Admin Mutations — Breaking Change Validation

- [ ] Calling `approveSubmission` WITHOUT `adminId` → mutation fails with validation error (expected behavior)
- [ ] Calling `rejectSubmission` WITHOUT `adminId` → mutation fails
- [ ] Calling `markWebsiteGenerated` WITHOUT `adminId` → mutation fails
- [ ] Calling `markDeployed` WITHOUT `adminId` → mutation fails
- [ ] Calling `markPaid` WITHOUT `adminId` → mutation fails

### 14. Referral Queries (Admin/Dashboard Use)

- [ ] `referrals.getByReferrer(referrerId)` → returns all referrals with referred creator names
- [ ] `referrals.getStats(referrerId)` → returns correct counts (total, pending, qualified, paid) and totalEarned
- [ ] `notifications.getByCreator(creatorId)` → returns all notifications newest first
- [ ] `notifications.getUnreadCount(creatorId)` → returns correct count

### 15. Analytics — Creator Stats (Convex Dashboard / CLI)

- [ ] `analytics.upsertCreatorStats(creatorId, "2026-02", "monthly", { submissionsCount: 5 })` → creates new record
- [ ] Calling again with same creatorId + period → updates existing record (no duplicate)
- [ ] `analytics.incrementStat(creatorId, "2026-02-17", "daily", "approvedCount", 1)` → creates record with approvedCount: 1
- [ ] Calling incrementStat again → increments to 2 (not resets)
- [ ] `analytics.getCreatorStats(creatorId, "monthly")` → returns all monthly records for creator
- [ ] `analytics.getCreatorStats(creatorId, "daily", "2026-02-01", "2026-02-28")` → returns only records in range
- [ ] `analytics.getPlatformStats("monthly", "2026-02")` → returns aggregated totals across all creators + `creatorsActive` count

### 16. Analytics — Website Stats (Convex Dashboard / CLI)

- [ ] `analytics.upsertWebsiteStats(submissionId, "2026-02-17", { pageViews: 100 })` → creates new record
- [ ] Calling again with same submissionId + date → updates existing (no duplicate)
- [ ] `analytics.getWebsiteStats(submissionId)` → returns `{ daily: [...], totals: { pageViews, uniqueVisitors, ... } }`
- [ ] `analytics.getWebsiteStats(submissionId, "2026-02-01", "2026-02-15")` → returns only records in date range
- [ ] `analytics.getWebsiteStatsByDate("2026-02-17")` → returns all website stats for that date

### 17. Analytics — Wired into Admin Mutations (End-to-End)

- [ ] Approve a submission → `analytics` table has a daily record with `approvedCount: 1` for today's date
- [ ] Approve a submission → `analytics` table has a monthly record with `approvedCount: 1` for this month
- [ ] Reject a submission → daily + monthly records have `rejectedCount` incremented
- [ ] Deploy a website (`markDeployed`) → daily + monthly records have `websitesLive` incremented
- [ ] Mark paid (`markPaid`) with `creatorPayout: 500` → daily + monthly `earningsTotal` increased by 500
- [ ] Mark paid with no `creatorPayout` → `earningsTotal` NOT incremented (guarded by `if` check)
- [ ] Submit a draft (`submissions.submit`) → daily + monthly records have `submissionsCount` incremented
- [ ] Approve 3 submissions for same creator on same day → daily `approvedCount` is 3, monthly `approvedCount` is 3

### 18. Analytics — Scheduled Aggregation Cron

- [ ] `convex/crons.ts` deploys successfully with `npx convex dev`
- [ ] Cron job `aggregate monthly stats` is registered (visible in Convex dashboard → Scheduled Functions)
- [ ] `analyticsJobs.getDailyRecords("2026-02-17")` → returns all daily analytics for that date
- [ ] `analyticsJobs.aggregateDailyToMonthly` → rolls up yesterday's daily records into monthly (test via Convex dashboard manual trigger)
- [ ] After aggregation: monthly record has values from the daily record merged via `upsertCreatorStats`

---

## Schema Validation

### 19. Convex Schema Deployment

- [ ] `npx convex dev` succeeds without schema validation errors
- [ ] All new tables exist: `notifications`, `pushTokens`, `auditLogs`, `referrals`, `analytics`, `websiteAnalytics`
- [ ] All new fields on `creators`: `referredByCode`
- [ ] All new fields on `submissions`: `rejectionReason`, `websiteUrl`
- [ ] All indexes created and queryable

---

## Known Limitations

- **Push notifications require APK rebuild** — `expo-notifications` is a native module, Expo Go does not support it
- **Referral code only on email signup** — OAuth (Google) users cannot enter a referral code during signup; planned for future profile settings screen
- **Admin UI not built yet** — All admin actions must be tested via Convex dashboard or CLI
- **₱100 referral bonus is hardcoded** — Amount is not configurable yet (in `convex/admin.ts` line 55)
- **`new_lead` notifications not wired** — Will be connected when leads CRUD mutations are implemented
- **No data migration for websiteContent → generatedWebsites** — Old data still in deprecated `websiteContent` table
- **Website analytics requires external integration** — Cloudflare Analytics API or Plausible for page view/visitor tracking
