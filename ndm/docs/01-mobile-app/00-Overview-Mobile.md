# Mobile App Overview — Negosyo Digital

## What Is This App?

Negosyo Digital is a React Native mobile app that helps Filipino "creators" (field agents) digitize local businesses. Creators visit a small business, collect information (photos, video/audio interview, business details), and submit it through the app. The platform then generates a website for the business, deploys it, and tracks leads — the creator earns a payout for each successful submission.

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| **Framework** | Expo SDK 54 + React Native 0.81 | Managed workflow, new architecture enabled |
| **Router** | Expo Router (file-based) | Typed routes enabled |
| **Styling** | NativeWind 4.x + Tailwind CSS 3.4 | Utility-first styling via className |
| **Backend** | Convex 1.31+ | Real-time database, serverless functions, file storage |
| **Authentication** | Clerk (`@clerk/clerk-expo` 2.x) | Email/password + Google OAuth |
| **Auth Integration** | `ConvexProviderWithClerk` | Clerk provides the auth token to Convex |
| **File Storage** | Cloudflare R2 | Photos uploaded directly via presigned URLs (AWS Sig V4) |
| **Transcription** | Groq Whisper API | Audio/video interview → text transcription |
| **Push Notifications** | Expo Notifications + Expo Push API | FCM on Android, APNs on iOS |
| **AI Content Pipeline** | Airtable (staging) → AI enhancement → Convex | Business content + image generation for websites |
| **Payments** | Wise API | PHP bank transfers for creator payouts |

---

## Authentication Flow

Authentication is handled by **Clerk** with **Convex** as the backend database. There is no Supabase in this project.

### How It Works

1. **Clerk** manages user identity (signup, login, sessions, OAuth, email verification)
2. **Convex** stores the application data (creators, submissions, earnings, etc.)
3. `ConvexProviderWithClerk` in the root layout bridges the two — Clerk's session token is passed to Convex for authenticated queries/mutations

### Providers (Root Layout)

```tsx
// app/_layout.tsx → providers/AppProviders.tsx
<ClerkProvider publishableKey={CLERK_KEY} tokenCache={tokenCache}>
  <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
    <NetworkProvider>
      {/* App routes */}
    </NetworkProvider>
  </ConvexProviderWithClerk>
</ClerkProvider>
```

- `tokenCache` uses `expo-secure-store` for persistent session storage
- Auth state (`isSignedIn`) drives routing: signed in → `/(app)/(tabs)`, signed out → `/(auth)/login`
- Offline fallback: caches `ndm_was_signed_in` in AsyncStorage, bypasses Clerk load wait if offline
- 10-second force-render timeout if Clerk initialization hangs

### Signup Flow

1. User enters first name, last name, email, password, optional phone, optional referral code
2. `signUp.create()` via Clerk creates the user
3. `signUp.prepareEmailAddressVerification()` sends a 6-digit code
4. User enters code → `signUp.attemptEmailAddressVerification()`
5. On success: `creators.create` mutation inserts a new creator record in Convex with:
   - `clerkId` (Clerk user ID)
   - `referralCode` (auto-generated: 2 chars first name + 1 char last name + 6 random alphanumeric)
   - `referredByCode` (if entered — triggers referral record creation)
   - `balance: 0`, `totalEarnings: 0`, `role: "creator"`, `status: "active"`
6. Session is activated → app navigates to dashboard

### Login Flow

1. User enters email + password
2. `signIn.create()` via Clerk authenticates
3. Session activated → navigates to dashboard
4. On first dashboard load, if no creator record exists (e.g., OAuth user), one is auto-created

### Google OAuth

1. `startOAuthFlow()` opens browser-based Google sign-in
2. Redirect URL: `negosyodigital://` (custom scheme)
3. On success, session is set → dashboard loads → creator record auto-created if missing

### Forgot Password

1. User enters email → `signIn.create({ strategy: "reset_password_email_code" })`
2. 6-digit code sent to email
3. User enters code + new password (minimum 8 characters)
4. Password strength indicator (4-level: weak/fair/good/strong)
5. On success → redirects to login

---

## App Structure (Complete File Tree)

```
app/
├── _layout.tsx                    # Root layout (AppProviders wrapper)
├── index.tsx                      # Welcome/landing → routes to auth or app
├── (auth)/
│   ├── _layout.tsx                # Auth group layout (Stack, slide animations)
│   ├── login.tsx                  # Email/password + Google OAuth login
│   ├── signup.tsx                 # Email signup with verification + referral code
│   └── forgot-password.tsx        # Password reset via email code
└── (app)/
    ├── _layout.tsx                # App group layout (requires auth, offline sync)
    ├── onboarding.tsx             # First-time profile completion
    ├── training.tsx               # Training intro screen
    ├── training-lessons.tsx       # 5 expandable training lessons
    ├── certification-quiz.tsx     # 5-question certification quiz
    ├── notifications.tsx          # All notifications list
    ├── edit-profile.tsx           # Edit profile form + avatar upload
    ├── change-password.tsx        # Change password with strength indicator
    ├── help-faq.tsx               # Help & FAQ (4 sections, 12 items)
    ├── privacy-policy.tsx         # Privacy Policy (12 sections)
    ├── terms-of-service.tsx       # Terms of Service (12 sections)
    ├── (tabs)/
    │   ├── _layout.tsx            # Bottom tab bar with central FAB
    │   ├── index.tsx              # Home/Dashboard
    │   ├── referrals.tsx          # Referral program
    │   ├── wallet.tsx             # Wallet + withdrawals
    │   └── profile.tsx            # Profile + settings menu
    ├── submissions/
    │   ├── index.tsx              # All submissions list
    │   └── [id].tsx               # Submission detail / continue draft
    └── submit/
        ├── info.tsx               # Step 1: Business info form
        ├── photos.tsx             # Step 2: Upload business photos
        ├── interview.tsx          # Step 3: Record video/audio interview
        ├── review.tsx             # Step 4: Review & submit
        └── success.tsx            # Submission confirmation
```

---

## Every Page — Detailed Breakdown

### Welcome Screen (`app/index.tsx`)

**What it shows:** Animated hero landing page with staggered fade-up animations — logo, badge, headline ("Digitize Local Businesses"), subtitle, and two CTA buttons (Sign Up / Log In).

**Logic:**
- Checks if onboarding was already completed
- Checks `AUTH_CACHE_KEY` for cached auth state (offline support)
- Routes to signup or login based on user state
- If already signed in, redirects straight to `/(app)/(tabs)`

---

### Login (`app/(auth)/login.tsx`)

**What it shows:** Email + password form, Google OAuth button (custom SVG logo), show/hide password toggle, "Forgot Password" link, "Sign Up" redirect.

**Logic:**
- `signIn.create({ identifier: email, password })` via Clerk
- Google OAuth: `startOAuthFlow()` → browser flow → callback to `negosyodigital://`
- On success: sets active session → navigates to `/(app)/(tabs)`
- Error handling: displays Clerk error messages inline

---

### Signup (`app/(auth)/signup.tsx`)

**What it shows:** Two-step flow — (1) signup form with first name, last name, email, phone (optional), password, referral code (optional), and Google OAuth; (2) 6-digit email verification code input with resend option.

**Logic:**
- `signUp.create()` creates Clerk user
- `prepareEmailAddressVerification({ strategy: "email_code" })` sends code
- `attemptEmailAddressVerification({ code })` verifies
- On success: `creators.create` mutation creates Convex profile with auto-generated referral code
- Referral code format: `[2 chars firstName][1 char lastName][6 random alphanumeric]`
- If `referredByCode` provided, triggers `referrals.createFromSignup()`

---

### Forgot Password (`app/(auth)/forgot-password.tsx`)

**What it shows:** Two-step — (1) email entry; (2) reset code + new password with strength indicator (4-level visual bar: weak/fair/good/strong).

**Logic:**
- `signIn.create({ strategy: "reset_password_email_code", identifier: email })`
- `attemptFirstFactor({ strategy: "reset_password_email_code", code, password })`
- Minimum 8 characters enforced
- Resend code functionality included

---

### Home / Dashboard (`app/(app)/(tabs)/index.tsx`)

**What it shows:**
- Welcome header with profile avatar + notification bell (unread badge)
- Dark-themed available balance card
- Quick stats row: Total Submissions, In Review, Verified (3 cards)
- Recent submissions list (3 items, "View All" link)
- Recent activity/notifications (5 items, "See All" link)

**Logic:**
- Queries: `creators.getByClerkId`, `submissions.getByCreatorId`, `notifications.getByCreator`, `notifications.getUnreadCount`
- Auto-creates creator profile on first load if missing (handles OAuth users)
- Redirects to `training.tsx` if creator is not certified (`certifiedAt` is null)
- Shows pending transcription status for in-progress submissions
- Notification metadata drives type-specific icons and colors

---

### Wallet (`app/(app)/(tabs)/wallet.tsx`)

**What it shows:**
- Available balance display with total earned / total withdrawn stats
- "Withdraw Funds" button → opens bottom sheet modal
- Withdrawal form: amount (min ₱100), account holder name, bank selection (15 Philippine banks), account number (bank-specific digit validation), city
- Recent earnings list (5 items)
- Withdrawal history (5 items) with status badges (pending/processing/completed/failed)

**Supported Banks (via Wise API):**
| Bank | Code | Digits |
|---|---|---|
| BDO Unibank | BDO | 10 |
| BPI | BPI | 10 |
| Metrobank | MBTC | 13 |
| UnionBank | UBP | 12 |
| Landbank | LBP | 10 |
| PNB | PNB | 12 |
| RCBC | RCBC | 10 |
| Security Bank | SECB | 13 |
| China Bank | CB | 12 |
| EastWest Bank | EW | 12 |
| AUB | AUB | 12 |
| UCPB | UCPB | 12 |
| PSBank | PSB | 12 |
| Robinsons Bank | RBB | 12 |
| GCash (via GXI) | GXI | 11 |

**Logic:**
- Queries: `creators.getByClerkId`, `earnings.getByCreator`, `withdrawals.getByCreator`
- Mutation: `withdrawals.create(creatorId, amount, accountHolderName, bankName, bankCode, accountNumber, city)`
- Balance is deducted immediately (optimistic) — Wise transfer initiated asynchronously
- Validation: minimum ₱100, sufficient balance, full name required, bank-specific digit count

---

### Profile (`app/(app)/(tabs)/profile.tsx`)

**What it shows:**
- Large avatar with name, email, referral code badge
- Stats strip: Submissions count, Balance (₱), Total Earned (₱)
- Menu sections:
  - **Account:** Edit Profile, Notifications, Change Password, Show Certificate (if certified)
  - **My Activity:** My Submissions, Referrals, Earnings
  - **Support:** Help & FAQ, Terms of Service, Privacy Policy
- Sign out button with confirmation dialog
- Certificate modal with download/share buttons (uses `CertificateCard` component + `expo-media-library`)

**Logic:**
- Queries: `creators.getByClerkId`, `submissions.getByCreatorId`
- Sign out: `signOut()` via Clerk + clears cached auth state
- Certificate: rendered via `CertificateCard` (forwardRef), captured as screenshot for sharing/download
- Offline banner shown when disconnected

---

### Referrals (`app/(app)/(tabs)/referrals.tsx`)

**What it shows:**
- Dark referral code card with copy + share buttons ("Copied!" feedback state)
- Stats row: Referred count, Qualified count, Rewards (₱)
- List of referred creators: avatar initial, name, join date, status badge (Signed Up / Qualified / Rewarded)
- "How it Works" section (3-step explanation)

**Logic:**
- Queries: `referrals.getByReferrer(creatorId)`, `referrals.getStats(creatorId)`
- Share: uses `expo-sharing` to share referral code text
- Copy: uses `expo-clipboard`
- Offline banner shown when disconnected

---

### Submission Flow — Step 1: Business Info (`app/(app)/submit/info.tsx`)

**What it shows:** Form with business name, business type (dropdown), owner name, owner phone, owner email (optional), address, city.

**Business Type Options:** Barber/Salon, Auto Shop, Spa/Massage, Restaurant, Clinic, Law Office, Craft/Producer, Other

**Logic:**
- Loads existing Convex draft via `submissions.getDraftByCreatorId` OR local cache (priority: server → local)
- Draft auto-save to AsyncStorage with 500ms debounce via `useFormDraftCache` hook
- 7-day expiration on local drafts
- Offline support: saves to AsyncStorage and continues to next step
- Creates/updates Convex submission via `submissions.create` or `submissions.update`
- Navigates to `photos.tsx` on continue

---

### Submission Flow — Step 2: Photos (`app/(app)/submit/photos.tsx`)

**What it shows:** Multi-photo picker from device library, thumbnail grid of selected/existing photos, upload progress indicator, remove button per photo.

**Logic:**
- Uses `expo-image-picker` for multi-select from library
- Uploads to R2 via presigned URLs (AWS Sig V4)
- Shows existing photos if continuing a draft
- Updates submission via `submissions.update({ photos: [...urls] })`
- Offline: queues photos in AsyncStorage for later upload via `useOfflineSync`
- Navigates to `interview.tsx` on continue

---

### Submission Flow — Step 3: Interview (`app/(app)/submit/interview.tsx`)

**What it shows:** Choice between Video or Audio interview mode.

**Video path:**
- Front-facing camera with recording controls
- Parallel audio capture for transcription
- Question carousel with 5 suggested interview questions
- Lighting tip overlay
- Video preview with playback controls

**Audio path:**
- Microphone recording with timer
- Waveform visualization
- Play/pause controls after recording
- Audio preview

**Logic:**
- Uses `expo-camera` for video, `expo-av` for audio recording/playback
- Uploads media to R2 via presigned URLs with progress tracking
- Updates submission via `submissions.update({ videoStorageId / audioStorageId })`
- Triggers `transcribeMedia` action asynchronously (Groq Whisper API, max 25MB)
- Offline: saves file locally, queues for upload via `useOfflineSync`
- Navigates to `review.tsx` on continue

---

### Submission Flow — Step 4: Review (`app/(app)/submit/review.tsx`)

**What it shows:** Summary of all entered data — business info, photo carousel preview, video/audio preview with playback, transcription status.

**Logic:**
- Reads full submission data via `submissions.getById`
- Submit button calls `submissions.submit(id)` which:
  - Changes status from `draft` → `submitted`
  - Sets `amount = 1000` (₱1,000)
  - Creates lead record from business owner info
  - Sets `airtableSyncStatus = "pending_push"`
  - Triggers `airtable.pushToAirtableInternal()` for AI image generation
  - Increments `analytics.submissionsCount`
- Offline: shows queue state with auto-sync info
- Navigates to `success.tsx` on submit

---

### Submission Flow — Success (`app/(app)/submit/success.tsx`)

**What it shows:** Green checkmark animation, transcription status (complete/processing/failed), "What happens next?" 3-step timeline, buttons for "View My Submissions" or "Back to Dashboard".

**Logic:**
- Displays different messaging based on transcription status
- Offline queued state: shows cloud icon, explains auto-sync behavior
- Clears local draft cache

---

### Submissions List (`app/(app)/submissions/index.tsx`)

**What it shows:** All submissions as cards with status badges and expandable progress indicators (photos ✓, interview ✓, submitted ✓). FAB button to create new submission.

**Status colors:**
| Status | Color |
|---|---|
| Draft | Gray |
| In Review / Submitted | Blue |
| Verified / Approved | Emerald |
| Rejected | Red |
| Website Ready | Blue |
| Deployed | Purple |
| Paid | Green |

**Logic:**
- Query: `submissions.getByCreatorId(creatorId)`
- Cards show: business type icon, business name, type, city, date, status badge
- Tap navigates to `submissions/[id].tsx`
- Back button redirects to dashboard (prevents going back through submit flow)

---

### Submission Detail (`app/(app)/submissions/[id].tsx`)

**What it shows:** Full submission detail with status-specific info cards:

| Status | Info Card Message |
|---|---|
| Draft | "Complete your submission" |
| Submitted | "Under Review (24-48 hours)" |
| Approved | "Website in progress" |
| Website Generated / Deployed | "Website ready" + URL link |
| Pending Payment | "Awaiting business owner payment" |
| Paid / Completed | "Congratulations! You earned ₱X" |

Also shows: business info section, photos carousel (horizontal scroll), interview section (video player with fullscreen modal OR audio player with progress bar), transcription (expandable), expected earnings.

**Logic:**
- Query: `submissions.getByIdWithCreator(id)` — includes creator info and deployed URL
- "Continue Submission" button for drafts → navigates back to submit flow at the right step
- Video: inline preview + fullscreen modal via `expo-av`
- Audio: custom player with seek bar

---

### Training Intro (`app/(app)/training.tsx`)

**What it shows:** Hero section with camera illustration, "Become a Certified Creator" headline, 5 training tips with colored icons (Lighting/yellow, Audio/blue, Portrait/teal, Interview/purple, Requirements/pink), "Start Training" button.

**Logic:**
- Simple navigational page → routes to `training-lessons.tsx`
- Shown when creator is not yet certified (`certifiedAt === null`)

---

### Training Lessons (`app/(app)/training-lessons.tsx`)

**What it shows:** 5 expandable lesson cards (first one open by default):

1. **Lighting** — Face the light, avoid backlighting, golden hour tips
2. **Audio** — Test first, kill noise, keep phone close
3. **Portrait** — Chest up, eye level, no obstructions
4. **Interview** — Warm up, origin story, speak slowly
5. **Requirements** — 3 required photo types: portrait, location, craft/product

**Logic:**
- Accordion-style expand/collapse with smooth animations
- Each lesson has tips with icons and an action box
- "Start Certification Quiz" button at bottom → navigates to `certification-quiz.tsx`

---

### Certification Quiz (`app/(app)/certification-quiz.tsx`)

**What it shows:** 5 multiple-choice questions (A/B/C/D), category badges with colors, progress bar, question counter with slide/fade animations between questions.

**Pass (≥4/5):** Success checkmark animation, "Congratulations!" message, score display, certificate card (capturable via `CertificateCard` component), share/download certificate buttons, "Go to Dashboard" button.

**Fail (<4/5):** Graduation cap icon, "Not quite there yet!" message, score with progress bar, "Try Again" button → back to training.

**Logic:**
- 5 hardcoded questions covering the training material
- On pass: calls `creators.certify(id)` which sets `certifiedAt` timestamp and sends notification
- Certificate captured as image via `ViewShot` → `expo-media-library` for download, `expo-sharing` for share

---

### Edit Profile (`app/(app)/edit-profile.tsx`)

**What it shows:** Large clickable avatar with camera badge overlay, form fields (first name, last name, phone number), success/error banners.

**Logic:**
- Image picker → uploads new avatar to R2 via `generateR2UploadUrl` action
- Mutation: `creators.update(id, { firstName, lastName, phone, profileImage })`
- Creates `profile_updated` notification on success
- Offline support: queues update

---

### Change Password (`app/(app)/change-password.tsx`)

**What it shows:** Three password fields (current, new, confirm) with show/hide toggles, password strength indicator (4-level bar), real-time confirmation match check (✓/✗ icon).

**Logic:**
- Validation: minimum 8 characters, must differ from current, confirmation must match
- Uses Clerk's `user.updatePassword({ currentPassword, newPassword })`
- Creates `password_changed` notification via `notifications.createForClient`
- Success banner indicates session re-authentication

---

### Notifications (`app/(app)/notifications.tsx`)

**What it shows:** List of all notifications with read/unread state (green dot for unread), "Mark all read" link.

**Notification Types & Icons:**
| Type | Icon | Color |
|---|---|---|
| `submission_approved` | Checkmark | Green |
| `submission_rejected` | X | Red |
| `new_lead` | Person+ | Blue |
| `payout_sent` | Cash | Green |
| `website_live` | Globe | Purple |
| `submission_created` | Plus | Indigo |
| `profile_updated` | Person | Amber |
| `password_changed` | Lock | Gray |
| `system` | Info | Gray |

**Logic:**
- Query: `notifications.getByCreator(creatorId)`
- Tap → `notifications.markAsRead(id)` + navigate to related submission if `data.submissionId` exists
- "Mark all read" → `notifications.markAllAsRead(creatorId)`
- Unread count badge displayed on home tab notification bell

---

### Onboarding (`app/(app)/onboarding.tsx`)

**What it shows:** First-time profile completion form — first name, middle name, last name, phone number (optional, Philippine validation).

**Logic:**
- Shown when signup didn't fully create a creator profile (e.g., OAuth flow)
- Pre-fills from Clerk user data if available
- Creates creator profile via `creators.create` with auto-generated referral code
- Redirects to dashboard on completion

---

### Help & FAQ (`app/(app)/help-faq.tsx`)

**What it shows:** 4 expandable accordion sections (first item expanded by default):

1. **Getting Started** (2 items) — What is the app, how to get certified
2. **Submissions** (4 items) — Steps to submit, what happens after, photo requirements, editing drafts
3. **Earnings & Payments** (3 items) — Payout amounts, referral bonuses, payment timing
4. **Account & Support** (3 items) — Password reset, profile updates, technical issues

**Logic:** Static content with smooth collapse/expand animations. Contact email referenced in support items.

---

### Privacy Policy (`app/(app)/privacy-policy.tsx`)

**What it shows:** 12 expandable sections with icons covering data collection, usage, storage, third-party services (Clerk, Convex, R2, Groq, Expo, Google), business owner data, push notifications, data retention, Philippine DPA compliance, children's privacy, and contact info.

**Last updated:** February 2026

---

### Terms of Service (`app/(app)/terms-of-service.tsx`)

**What it shows:** 12 expandable sections covering acceptance, registration, certification, submissions, payments (₱500 video / ₱300 audio / ₱1,000 referral), referral program, prohibited conduct, IP, termination, liability, Philippine governing law, and contact.

**Last updated:** February 2026

---

## Shared Components

### `CertificateCard` (`components/CertificateCard.tsx`)
ForwardRef-wrapped component rendering a professional certification certificate. Green top/bottom banners, ribbon badge, dynamic creator name, "Certificate of Completion" title, month/year date. Designed for screenshot capture and export.

### `OfflineBanner` (`components/OfflineBanner.tsx`)
Lightweight banner that appears when network is disconnected. Uses `useNetwork()` hook. Warning icon + "You're offline" message. Only renders when `isConnected === false` (null = still determining, avoids flash).

---

## Providers

### `AppProviders` (`providers/AppProviders.tsx`)
Root provider wrapping the entire app. Order: ClerkProvider → ConvexProviderWithClerk → NetworkProvider. Handles loading states, offline fallback (bypasses Clerk if cached auth exists), 10-second force-render timeout.

### `NetworkProvider` (`providers/NetworkProvider.tsx`)
Context provider for network connectivity. Uses `@react-native-community/netinfo`. Exposes `useNetwork()` hook returning `{ isConnected: boolean | null }`. Defaults to online if NetInfo unavailable.

---

## Custom Hooks

### `useFormDraftCache` (`hooks/useFormDraftCache.ts`)
Manages form draft persistence with 500ms debounce to AsyncStorage. 7-day expiration. Methods: `saveDraft()`, `loadDraft()`, `clearDraft()`. Auto-cleanup on unmount. Stores: businessName, businessType, ownerName, ownerPhone, ownerEmail, address, city.

### `useOfflineSync` (`hooks/useOfflineSync.ts`)
Syncs offline-queued data when reconnected. Monitors network via NetworkProvider. Syncs 4 types: pending business info, pending photos (R2 upload), pending interview (R2 upload, 20-min timeout for large videos), pending final submit. Shows alert on successful sync. Auto-triggers on reconnection (2s delay).

### `usePushNotifications` (`hooks/usePushNotifications.ts`)
Registers device for push notifications. Checks physical device requirement, requests permissions, creates Android notification channel (vibration, green color #10b981), registers with Expo Push API (project ID: `2adbda2f-fecd-4fdd-91b8-56db76e0c780`), stores token in backend via `notifications.registerPushToken`.

---

## Database Schema (Complete)

### `creators` — User profiles

| Field | Type | Notes |
|---|---|---|
| `clerkId` | string | Clerk auth ID (indexed) |
| `email` | string | Email address (indexed) |
| `firstName` | string? | |
| `middleName` | string? | |
| `lastName` | string? | |
| `phone` | string? | |
| `profileImage` | string? | R2 public URL |
| `balance` | number | Current available balance (₱) |
| `totalEarnings` | number | Lifetime earnings (₱) |
| `totalWithdrawn` | number | Total withdrawn (₱) |
| `submissionCount` | number | Number of submissions created |
| `referralCode` | string | Unique code for referrals (indexed) |
| `referredByCode` | string? | Code used during signup |
| `role` | string | Always `"creator"` |
| `status` | string | `"active"` (indexed) |
| `certifiedAt` | number? | Timestamp of certification |
| `level` | number? | Creator tier level |
| `createdAt` | number | |
| `updatedAt` | number | |
| `lastActiveAt` | number | |

**Indexes:** `by_clerk_id`, `by_email`, `by_referral_code`, `by_status`

---

### `submissions` — Business submissions

| Field | Type | Notes |
|---|---|---|
| `creatorId` | Id\<"creators"\> | Foreign key |
| `businessName` | string | |
| `businessType` | string | |
| `businessDescription` | string? | |
| `ownerName` | string | |
| `ownerPhone` | string | |
| `ownerEmail` | string? | |
| `address` | string | |
| `city` | string | |
| `province` | string? | |
| `barangay` | string? | |
| `postalCode` | string? | |
| `coordinates` | object? | `{ lat: number, lng: number }` |
| `photos` | string[] | Array of R2 URLs |
| `hasProducts` | boolean? | Affects photo requirements |
| `videoStorageId` | string? | R2 video reference |
| `videoUrl` | string? | |
| `audioStorageId` | string? | R2 audio reference |
| `audioUrl` | string? | |
| `transcript` | string? | Transcribed text |
| `transcriptionStatus` | string? | `"processing"` / `"complete"` / `"failed"` / `"skipped"` |
| `transcriptionError` | string? | Error message |
| `aiGeneratedContent` | object? | AI-extracted services, USPs |
| `status` | string | `"draft"` → `"submitted"` → `"approved"` / `"rejected"` → `"website_generated"` → `"deployed"` → `"paid"` |
| `rejectionReason` | string? | Admin feedback |
| `reviewedBy` | string? | Admin Clerk ID |
| `reviewedAt` | number? | |
| `websiteUrl` | string? | Deployed website URL |
| `amount` | number? | Submission value |
| `creatorPayout` | number? | Amount paid to creator |
| `platformFee` | number? | |
| `creatorPaidAt` | number? | |
| `airtableRecordId` | string? | Airtable AI pipeline record |
| `airtableSyncStatus` | string? | `"pending_push"` / `"pushed"` / `"content_received"` / `"synced"` / `"error"` |
| `sentEmailAt` | number? | Business owner email timestamp |

**Indexes:** `by_creator_id`, `by_status`, `by_airtable_sync`, `by_creator_status`, `by_city`

---

### `generatedWebsites` — Website data from submissions

| Field | Type | Notes |
|---|---|---|
| `submissionId` | Id\<"submissions"\> | Foreign key |
| `html` | string? | Generated HTML |
| `css` | string? | Generated CSS |
| `deployedUrl` | string? | Live URL |
| `publishedUrl` | string? | |
| `netlifySiteId` | string? | |
| `cfPagesProjectName` | string? | |
| `status` | string? | `"generated"` / `"deployed"` / `"live"` |
| `heroTitle`, `heroSubtitle`, `heroHeadline`, etc. | string? | Website hero section content |
| `aboutText`, `aboutDescription`, `aboutContent`, etc. | string? | About section content |
| `featuredHeadline`, `featuredProducts`, etc. | various | Featured section |
| `servicesHeadline`, `servicesDescription`, etc. | string? | Services section |
| `contactCta` | string? | Contact call-to-action |
| `businessName`, `tagline`, `tone` | string? | Brand fields |
| `services`, `images`, `contact`, `contactInfo`, `socialLinks` | various | Structured data |
| `enhancedImages` | object? | AI-enhanced images: `headshot`, `interior_1`, `interior_2`, `exterior`, `product_1`, `product_2` — each with `url` and `storageId` |
| `subdomain`, `customDomain` | string? | Domain settings |
| `airtableSyncedAt` | number? | |

**Indexes:** `by_submission_id`, `by_status`

---

### `earnings` — Income transaction records

| Field | Type | Notes |
|---|---|---|
| `creatorId` | Id\<"creators"\> | |
| `submissionId` | Id\<"submissions"\>? | |
| `amount` | number | Amount in ₱ |
| `type` | union | `"submission_approved"` / `"referral_bonus"` / `"lead_bonus"` |
| `status` | union | `"pending"` / `"available"` / `"withdrawn"` |
| `createdAt` | number | |

**Indexes:** `by_creator`, `by_submission`

---

### `withdrawals` — Payout requests via Wise

| Field | Type | Notes |
|---|---|---|
| `creatorId` | Id\<"creators"\> | |
| `amount` | number | Amount in ₱ |
| `payoutMethod` | literal | `"bank_transfer"` |
| `accountHolderName` | string | |
| `bankName` | string | Display name (e.g., "BDO Unibank") |
| `bankCode` | string | Wise bank code (e.g., "BDO") |
| `accountNumber` | string | |
| `city` | string? | Required for Wise PHP transfers |
| `accountDetails` | string? | Legacy display string |
| `status` | union | `"pending"` → `"processing"` → `"completed"` / `"failed"` |
| `processedAt` | number? | |
| `transactionRef` | string? | |
| `wiseTransferId` | string? | Wise API transfer ID |
| `wiseRecipientId` | string? | Wise API recipient ID |
| `failureReason` | string? | |
| `createdAt` | number | |

**Indexes:** `by_creator`, `by_status`

---

### `notifications` — In-app notifications

| Field | Type | Notes |
|---|---|---|
| `creatorId` | Id\<"creators"\> | |
| `type` | union | 9 types (see Notifications page section) |
| `title` | string | |
| `body` | string | |
| `data` | object? | Flexible payload: `{ submissionId?, leadId?, ... }` |
| `read` | boolean | |
| `sentAt` | number | |

**Indexes:** `by_creator`, `by_creator_unread`

---

### `referrals` — Referral tracking

| Field | Type | Notes |
|---|---|---|
| `referrerId` | Id\<"creators"\> | Creator who shared the code |
| `referredId` | Id\<"creators"\> | Creator who signed up with code |
| `referralCode` | string | Code that was used |
| `status` | union | `"pending"` → `"qualified"` → `"paid"` |
| `bonusAmount` | number? | ₱1,000 when qualified |
| `qualifiedAt` | number? | |
| `paidAt` | number? | |
| `createdAt` | number | |

**Indexes:** `by_referrer`, `by_referred`, `by_status`

---

### `leads` — Contact inquiries from websites

| Field | Type | Notes |
|---|---|---|
| `submissionId` | Id\<"submissions"\> | |
| `creatorId` | Id\<"creators"\> | |
| `businessOwnerId` | string? | |
| `source` | union | `"website"` / `"qr_code"` / `"direct"` |
| `name` | string | |
| `phone` | string | |
| `email` | string? | |
| `message` | string? | |
| `status` | union | `"new"` → `"contacted"` → `"qualified"` → `"converted"` / `"lost"` |
| `createdAt` | number | |

**Indexes:** `by_submission`, `by_creator`, `by_status`

---

### `leadNotes` — Notes on leads

| Field | Type | Notes |
|---|---|---|
| `leadId` | Id\<"leads"\> | |
| `creatorId` | Id\<"creators"\> | |
| `content` | string | |
| `createdAt` | number | |

**Indexes:** `by_lead`

---

### `pushTokens` — Device push notification tokens

| Field | Type | Notes |
|---|---|---|
| `creatorId` | Id\<"creators"\> | |
| `token` | string | Expo push token |
| `platform` | union | `"ios"` / `"android"` / `"web"` |
| `active` | boolean | |

**Indexes:** `by_creator`, `by_token`

---

### `payoutMethods` — Saved payment methods

| Field | Type | Notes |
|---|---|---|
| `creatorId` | Id\<"creators"\> | |
| `type` | literal | `"bank_transfer"` |
| `accountName` | string | |
| `accountNumber` | string | |
| `bankName` | string? | |
| `bankCode` | string? | |
| `isDefault` | boolean | |

**Indexes:** `by_creator`

---

### `analytics` — Creator/platform statistics

| Field | Type | Notes |
|---|---|---|
| `creatorId` | Id\<"creators"\> | |
| `period` | string | `"2026-02"` (monthly) or `"2026-02-17"` (daily) |
| `periodType` | union | `"daily"` / `"monthly"` |
| `submissionsCount` | number | |
| `approvedCount` | number | |
| `rejectedCount` | number | |
| `leadsGenerated` | number | |
| `earningsTotal` | number | |
| `websitesLive` | number | |
| `referralsCount` | number | |
| `updatedAt` | number | |

**Indexes:** `by_creator_period`, `by_period`

---

### `websiteAnalytics` — Per-website traffic

| Field | Type | Notes |
|---|---|---|
| `submissionId` | Id\<"submissions"\> | |
| `date` | string | `"2026-02-17"` |
| `pageViews` | number | |
| `uniqueVisitors` | number | |
| `contactClicks` | number | |
| `whatsappClicks` | number | |
| `phoneClicks` | number | |
| `formSubmissions` | number | |
| `updatedAt` | number | |

**Indexes:** `by_submission_date`, `by_date`

---

### `auditLogs` — Admin action tracking

| Field | Type | Notes |
|---|---|---|
| `adminId` | string | Clerk ID of admin |
| `action` | union | `"submission_approved"` / `"submission_rejected"` / `"website_generated"` / `"website_deployed"` / `"payment_sent"` / `"submission_deleted"` / `"creator_updated"` / `"manual_override"` |
| `targetType` | union | `"submission"` / `"creator"` / `"website"` / `"withdrawal"` |
| `targetId` | string | |
| `metadata` | object? | Context (old/new values, reasons) |
| `timestamp` | number | |

**Indexes:** `by_admin`, `by_target`, `by_action`, `by_timestamp`

---

### `settings` — Platform configuration

| Field | Type | Notes |
|---|---|---|
| `key` | string | e.g., `"referral_bonus_amount"`, `"min_withdrawal"` (indexed) |
| `value` | any | Number, string, boolean, or object |
| `description` | string? | |
| `updatedAt` | number | |
| `updatedBy` | string? | Admin Clerk ID |

**Indexes:** `by_key`

---

## Convex Backend — All Functions

### `creators.ts` — Creator CRUD

| Function | Type | Purpose |
|---|---|---|
| `getByClerkId(clerkId)` | Query | Fetch creator by Clerk ID |
| `create(clerkId, email, ...)` | Mutation | Create creator or update lastActiveAt; initializes referral if code provided |
| `update(id, firstName?, lastName?, phone?, profileImage?)` | Mutation | Update profile, sends `profile_updated` notification |
| `updateLastActive(clerkId)` | Mutation | Updates `lastActiveAt` timestamp |
| `certify(id)` | Mutation | Sets `certifiedAt`, sends notification |

### `submissions.ts` — Submission lifecycle

| Function | Type | Purpose |
|---|---|---|
| `create(creatorId, businessName, ...)` | Mutation | Creates draft, increments `submissionCount` |
| `update(id, ...)` | Mutation | Updates fields; triggers transcription if media uploaded |
| `submit(id)` | Mutation | Status → `"submitted"`, sets amount=1000, creates lead, triggers Airtable push, increments analytics |
| `getById(id)` | Query | Fetch single submission |
| `getByIdWithCreator(id)` | Query | Submission + creator info + deployed URL |
| `getByCreatorId(creatorId)` | Query | All submissions for creator |
| `getDraftByCreatorId(creatorId)` | Query | Most recent draft |
| `getAll()` | Query | All submissions (admin) |
| `getAllWithCreator()` | Query | All with creator info (admin) |
| `getByStatus(status)` | Query | Filter by status (admin) |
| `updateTranscription(submissionId, transcription)` | Internal Mutation | Save transcript |
| `updateTranscriptionStatus(submissionId, status, error?)` | Internal Mutation | Update transcription status |
| `transcribeMedia(submissionId, storageId, mediaType)` | Internal Action | Calls Groq Whisper API (max 25MB) |

### `admin.ts` — Admin operations

| Function | Type | Purpose |
|---|---|---|
| `approveSubmission(id, adminId)` | Mutation | Approve → notify + audit log + analytics |
| `rejectSubmission(id, reason, adminId)` | Mutation | Reject with reason → notify + audit + analytics |
| `markWebsiteGenerated(id, websiteUrl, adminId)` | Mutation | Status → `"website_generated"` |
| `markDeployed(id, websiteUrl, adminId)` | Mutation | Status → `"deployed"`, increments `websitesLive` |
| `markPaid(id, adminId)` | Mutation | Status → `"paid"`, adds payout to balance, creates earning, checks referral qualification |
| `getAllSubmissionsWithCreators()` | Query | All submissions with creator details |

### `withdrawals.ts` — Payout management

| Function | Type | Purpose |
|---|---|---|
| `create(creatorId, amount, accountHolderName, bankName, bankCode, accountNumber, city)` | Mutation | Creates withdrawal, deducts balance immediately, initiates Wise transfer async |
| `updateStatus(id, status, transactionRef?, adminId)` | Mutation | Admin override; restores balance if failed, increments `totalWithdrawn` if completed |
| `getByCreator(creatorId)` | Query | All withdrawals for creator |
| `getByStatus(status)` | Query | Filter by status with creator enrichment |
| `getAll()` | Query | All withdrawals with creator details |
| `setWiseTransferIds(withdrawalId, wiseTransferId, wiseRecipientId)` | Internal Mutation | Store Wise IDs |
| `markFailed(withdrawalId, reason?)` | Internal Mutation | Mark failed + restore balance |
| `updateByTransactionRef(transactionRef, status)` | Internal Mutation | Called by Wise webhook |

### `wise.ts` (Convex) — Wise integration

| Function | Type | Purpose |
|---|---|---|
| `initiateTransfer(withdrawalId, ...)` | Internal Action | Full Wise flow: create recipient → quote → transfer → fund. On failure: marks failed + restores balance |

### `notifications.ts` — Notification system

| Function | Type | Purpose |
|---|---|---|
| `createAndSend(creatorId, type, title, body, data?)` | Internal Mutation | Creates notification + schedules push |
| `createForClient(creatorId, type, title, body, data?)` | Mutation | Client-created notification (password changes, etc.) |
| `sendPushNotification(creatorId, title, body, data?)` | Internal Action | Sends via Expo Push API; handles invalid tokens |
| `registerPushToken(creatorId, token, platform)` | Mutation | Register device token |
| `removePushToken(token)` | Mutation | Deactivate token |
| `markAsRead(id)` | Mutation | Mark single notification read |
| `markAllAsRead(creatorId)` | Mutation | Mark all notifications read |
| `getByCreator(creatorId)` | Query | All notifications |
| `getUnreadCount(creatorId)` | Query | Unread count |

### `earnings.ts` — Income tracking

| Function | Type | Purpose |
|---|---|---|
| `create(creatorId, submissionId, amount, type)` | Internal Mutation | Create earning record |
| `getByCreator(creatorId)` | Query | All earnings with business names |
| `getBySubmission(submissionId)` | Query | Earnings for submission |
| `getSummary(creatorId)` | Query | Aggregated: total, available, pending, withdrawn, by type |

### `referrals.ts` — Referral program

| Function | Type | Purpose |
|---|---|---|
| `createFromSignup(referrerId, referredId, referralCode)` | Internal Mutation | Create pending referral (prevents duplicates) |
| `qualifyByCreator(referredCreatorId, submissionId, bonusAmount)` | Internal Mutation | Status → `"qualified"`, creates earning for referrer, adds bonus to balance, notifies |
| `getByReferrer(referrerId)` | Query | Referrals with referred creator info |
| `getStats(referrerId)` | Query | Total, pending, qualified, paid, totalEarned |

### `leads.ts` — Lead management

| Function | Type | Purpose |
|---|---|---|
| `create(submissionId, creatorId, source, name, phone, ...)` | Mutation | Create lead, increment analytics, notify creator |
| `updateStatus(id, status)` | Mutation | Move through pipeline |
| `remove(id)` | Mutation | Delete lead + associated notes |
| `getBySubmission(submissionId)` | Query | Leads for business |
| `getByCreator(creatorId)` | Query | All leads across businesses |
| `getCountBySubmission(submissionId)` | Query | Count breakdown by status |

### `analytics.ts` — Statistics

| Function | Type | Purpose |
|---|---|---|
| `incrementStat(creatorId, period, periodType, field, delta)` | Internal Mutation | Real-time stat increment |
| `upsertCreatorStats(creatorId, period, periodType, stats)` | Internal Mutation | Create/update period stats |
| `getCreatorStats(creatorId, periodType, from?, to?)` | Query | Stats for period range |
| `getPlatformStats(periodType, period)` | Query | Platform-wide aggregated stats |

### `airtable.ts` — AI content pipeline

| Function | Type | Purpose |
|---|---|---|
| `pushToAirtable(submissionId)` | Action | Push submission to Airtable for AI image enhancement |
| `fetchEnhancedContentWithRetry(submissionId, ..., retryCount)` | Internal Action | Fetch AI images with exponential backoff (30s, 1m, 2m, 5m, 10m) |
| `saveEnhancedContent(submissionId, enhancedImages, aiTextFields)` | Internal Mutation | Save to `generatedWebsites` |
| `getSyncStatus(submissionId)` | Query | Airtable sync status |
| `getEnhancedContent(submissionId)` | Query | Enhanced images + AI text |

---

## HTTP Endpoints (`convex/http.ts`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/airtable-webhook` | Receives AI image generation completion from Airtable. Validates `convexRecordId`, processes enhanced image URLs, triggers download + storage. |
| POST | `/wise-webhook` | Receives transfer state changes from Wise. Maps states: `outgoing_payment_sent` → completed, `processing` → processing, `cancelled`/`refunded`/`bounced` → failed. Updates withdrawal + notifies creator. |
| GET | `/health` | Health check. Returns `{ status: "ok", timestamp }`. |

---

## Services (`services/wise.ts`)

Pure Wise API client (no Convex dependencies). Used by `convex/wise.ts` internal action.

| Function | Purpose |
|---|---|
| `createRecipient(config, details)` | Create PHP bank account in Wise |
| `createQuote(config, amountPHP)` | Create PHP→PHP transfer quote |
| `createTransfer(config, recipientId, quoteId, reference)` | Create transfer with UUID |
| `fundTransfer(config, transferId)` | Fund transfer (sandbox uses simulation endpoint) |
| `getTransfer(config, transferId)` | Fetch transfer state |
| `getAccountRequirements(config, amountPHP)` | Fetch account requirements |

Endpoints: Sandbox `api.sandbox.transferwise.tech` / Production `api.wise.com`

---

## Key System Workflows

### Submission Lifecycle

```
draft → submitted → approved → website_generated → deployed → paid
                  ↘ rejected (with reason — creator can resubmit)
```

1. **Create draft** — `submissions.create()`, saved locally + server
2. **Add media** — Photos → R2, Video/Audio → R2 + Groq transcription
3. **Submit** — Status → `"submitted"`, amount set, lead auto-created, Airtable push triggered
4. **Airtable AI pipeline** — Photos sent to Airtable → AI generates enhanced images + text → webhook callback → images stored in Convex
5. **Admin review** — Approve (→ notify + analytics) or Reject (→ notify with reason)
6. **Website deployment** — Admin marks deployed, websitesLive incremented
7. **Payment** — Admin marks paid → payout added to balance → earning record created → referral check triggered

### Withdrawal Workflow

1. Creator requests withdrawal (min ₱100) — balance deducted immediately
2. `wise.initiateTransfer()`: create recipient → quote → transfer → fund
3. Wise processes transfer → sends webhook to `/wise-webhook`
4. On completion: status → `"completed"`, `totalWithdrawn` incremented, creator notified
5. On failure: status → `"failed"`, balance restored

### Referral Workflow

1. Creator A gets `referralCode` during signup
2. Creator B signs up with Creator A's code → pending referral created
3. Creator B's first submission gets approved and paid
4. `referrals.qualifyByCreator()` → status `"qualified"`, ₱1,000 bonus → Creator A's balance + earning + notification

### Push Notification Workflow

1. Device registers token via `notifications.registerPushToken()`
2. System events call `notifications.createAndSend()` → saves to DB + schedules push
3. `sendPushNotification()` → fetches active tokens → POST to `https://exp.host/--/api/v2/push/send`
4. Invalid tokens auto-deactivated

---

## Creator Earnings

| Source | Amount | Trigger |
|---|---|---|
| Approved video submission | ₱500 | Admin marks paid |
| Approved audio submission | ₱300 | Admin marks paid |
| Referral bonus | ₱1,000 | Referred creator's first submission paid |
| Lead bonus | Planned | Website generates a lead |

---

## Environment Variables

### Convex (set via `npx convex env set`)

| Variable | Purpose |
|---|---|
| `GROQ_API_KEY` | Groq Whisper API for audio/video transcription |
| `R2_PUBLIC_URL` | Cloudflare R2 public URL for photo access |
| `R2_ACCOUNT_ID` | Cloudflare R2 account ID |
| `R2_ACCESS_KEY_ID` | R2 access key for uploads |
| `R2_SECRET_ACCESS_KEY` | R2 secret key for uploads |
| `R2_BUCKET_NAME` | R2 bucket name (default: `negosyo-digital`) |
| `AIRTABLE_API_KEY` | Airtable API key for AI content pipeline |
| `AIRTABLE_BASE_ID` | Airtable base ID |
| `AIRTABLE_TABLE_ID` | Airtable table ID |
| `WISE_SANDBOX` | `"true"` / `"false"` for environment selection |
| `WISE_SANDBOX_TOKEN` | Sandbox Wise API token |
| `WISE_SANDBOX_PROFILE_ID` | Sandbox Wise profile ID |
| `WISE_API_TOKEN` | Production Wise API token |
| `WISE_PROFILE_ID` | Production Wise profile ID |

### App (`.env` or EAS secrets)

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `EXPO_PUBLIC_CONVEX_URL` | Convex deployment URL |

---

## App Configuration

- **Bundle ID / Package:** `com.negosyodigital.app`
- **Custom Scheme:** `negosyodigital://`
- **Orientation:** Portrait only
- **EAS Project ID:** `2adbda2f-fecd-4fdd-91b8-56db76e0c780`
- **New Architecture:** Enabled
- **Permissions:** Camera, Microphone, Photo Library, Storage, Audio Settings
