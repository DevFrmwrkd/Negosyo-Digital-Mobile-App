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
| **File Storage** | Cloudflare R2 | Photos uploaded directly via presigned URLs |
| **Transcription** | Groq Whisper API | Audio/video interview → text transcription |
| **Push Notifications** | Expo Notifications + Expo Push API | FCM on Android, APNs on iOS |
| **AI Content Pipeline** | Airtable (staging) → AI enhancement → Convex | Business content generation for websites |

---

## Authentication Flow

Authentication is handled by **Clerk** with **Convex** as the backend database. There is no Supabase in this project.

### How It Works

1. **Clerk** manages user identity (signup, login, sessions, OAuth, email verification)
2. **Convex** stores the application data (creators, submissions, earnings, etc.)
3. `ConvexProviderWithClerk` in the root layout bridges the two — Clerk's session token is passed to Convex for authenticated queries/mutations

### Providers (Root Layout)

```tsx
// app/_layout.tsx
<ClerkProvider publishableKey={CLERK_KEY} tokenCache={tokenCache}>
  <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
    {/* App routes */}
  </ConvexProviderWithClerk>
</ClerkProvider>
```

- `tokenCache` uses `expo-secure-store` for persistent session storage
- Auth state (`isSignedIn`) drives routing: signed in → `/(app)/dashboard`, signed out → `/(auth)/login`

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

---

## App Structure

```
app/
├── _layout.tsx              # Root layout (ClerkProvider + ConvexProviderWithClerk)
├── index.tsx                # Redirect to auth/app based on sign-in state
├── (auth)/
│   ├── _layout.tsx          # Auth group layout (Stack)
│   ├── login.tsx            # Email/password + Google OAuth login
│   └── signup.tsx           # Email signup with verification + Google OAuth + referral code
└── (app)/
    ├── _layout.tsx          # App group layout (requires auth)
    ├── dashboard.tsx         # Home screen: balance, recent submissions, notification bell
    ├── notifications.tsx     # In-app notification list with deep linking
    ├── onboarding.tsx        # First-time user onboarding (if needed)
    ├── submissions/
    │   ├── index.tsx         # All submissions list with status badges
    │   └── [id].tsx          # Submission detail / continue draft
    └── submit/
        ├── info.tsx          # Step 1: Business info form
        ├── photos.tsx        # Step 2: Upload business photos (R2)
        ├── interview.tsx     # Step 3: Record video/audio interview
        ├── review.tsx        # Step 4: Review & submit
        └── success.tsx       # Submission confirmation
```

---

## Convex Backend Overview

All backend logic lives in the `convex/` directory. Key files:

| File | Purpose |
|---|---|
| `schema.ts` | Database schema (all tables, fields, indexes) |
| `creators.ts` | Creator CRUD (create, update, getByClerkId) |
| `submissions.ts` | Submission CRUD + transcription pipeline |
| `admin.ts` | Admin mutations (approve, reject, deploy, pay) + audit logs + analytics |
| `notifications.ts` | In-app + push notification system |
| `referrals.ts` | Referral tracking and bonus payout |
| `analytics.ts` | Creator and website analytics |
| `analyticsJobs.ts` | Scheduled aggregation (daily → monthly rollup) |
| `crons.ts` | Convex cron jobs (daily aggregation at midnight UTC) |
| `auditLogs.ts` | Admin action audit trail |
| `generatedWebsites.ts` | Website generation and deployment data |
| `airtable.ts` | Airtable integration for AI content pipeline |

---

## Key Concepts

### Submission Lifecycle

```
draft → submitted → approved → website_generated → deployed → paid
                  ↘ rejected (with reason — creator can resubmit)
```

### Creator Earnings

Creators earn from:
- **Approved submissions** — fixed payout per submission
- **Referral bonuses** — ₱100 when a referred creator's first submission is approved
- **Lead bonuses** — (planned) earnings from leads generated by deployed websites

### Real-Time Updates

Convex provides real-time reactivity — when an admin approves a submission:
1. The submission status updates instantly on the creator's dashboard
2. An in-app notification appears immediately
3. A push notification is sent to the creator's device
4. Analytics counters increment automatically

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

### App (`.env` or EAS secrets)

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `EXPO_PUBLIC_CONVEX_URL` | Convex deployment URL |
