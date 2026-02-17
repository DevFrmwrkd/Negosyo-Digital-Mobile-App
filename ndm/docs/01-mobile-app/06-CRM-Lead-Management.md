# CRM & Lead Management — Negosyo Digital

## Overview

When a business website is deployed, it generates leads through contact forms, WhatsApp buttons, phone call buttons, and QR codes. These leads flow into the app's CRM system where creators and business owners can track, qualify, and convert them.

---

## Schema (Convex)

### `leads` table

Tracks leads generated from deployed business websites.

```ts
// convex/schema.ts
leads: defineTable({
  submissionId: v.id("submissions"),   // Which business website generated the lead
  creatorId: v.id("creators"),         // Which creator submitted the business
  businessOwnerId: v.optional(v.string()), // Future link to business owner account
  source: v.union(
    v.literal("website"),              // Contact form on the generated website
    v.literal("qr_code"),             // QR code scan (printed materials, storefront)
    v.literal("direct"),              // Direct link / manual entry
  ),
  name: v.string(),                    // Lead's name
  phone: v.string(),                   // Lead's phone number
  email: v.optional(v.string()),       // Lead's email (optional)
  message: v.optional(v.string()),     // Lead's inquiry message
  status: v.union(
    v.literal("new"),                  // Just came in, not yet contacted
    v.literal("contacted"),            // Business owner reached out
    v.literal("qualified"),            // Lead is a genuine prospect
    v.literal("converted"),            // Lead became a customer
    v.literal("lost"),                 // Lead didn't convert
  ),
  createdAt: v.number(),               // Timestamp (Date.now())
})
  .index("by_submission", ["submissionId"])  // All leads for a business
  .index("by_creator", ["creatorId"])        // All leads across a creator's businesses
  .index("by_status", ["status"]),           // Filter by pipeline stage
```

### `leadNotes` table

Tracks follow-up notes and activities on individual leads.

```ts
// convex/schema.ts
leadNotes: defineTable({
  leadId: v.id("leads"),         // Which lead this note belongs to
  creatorId: v.id("creators"),   // Who wrote the note
  content: v.string(),           // Note content (e.g., "Called, will visit tomorrow")
  createdAt: v.number(),         // Timestamp
})
  .index("by_lead", ["leadId"]), // All notes for a lead, chronological
```

---

## Lead Pipeline

```
new → contacted → qualified → converted
                            ↘ lost
```

| Stage | Description | Who Acts |
|---|---|---|
| **new** | Lead submitted via website form, QR scan, or direct link | System (auto) |
| **contacted** | Business owner or creator reached out to the lead | Business owner / Creator |
| **qualified** | Lead is a genuine prospect with real interest | Business owner / Creator |
| **converted** | Lead became a paying customer | Business owner / Creator |
| **lost** | Lead didn't convert (no response, not interested, etc.) | Business owner / Creator |

---

## Lead Sources

### Website Contact Form
- The generated business website includes a contact form
- When a visitor submits the form, it creates a lead with `source: "website"`
- Fields captured: name, phone, email (optional), message (optional)

### QR Code
- Business owners can print QR codes linking to their website
- QR code scans that result in form submissions create leads with `source: "qr_code"`

### Direct
- Manually entered leads or leads from direct link shares
- `source: "direct"`

---

## Backend Functions (Planned)

### Mutations

| Function | Description |
|---|---|
| `leads.create` | Create a new lead (called by website form handler) |
| `leads.updateStatus` | Move lead through pipeline stages |
| `leads.addNote` | Add a follow-up note to a lead |
| `leads.delete` | Remove a lead (with audit log) |

### Queries

| Function | Description |
|---|---|
| `leads.getBySubmission(submissionId)` | All leads for a specific business website |
| `leads.getByCreator(creatorId)` | All leads across all of a creator's businesses |
| `leads.getByStatus(status)` | Filter leads by pipeline stage |
| `leadNotes.getByLead(leadId)` | All notes for a specific lead |

---

## Notifications Integration

When a new lead comes in:
- A `new_lead` notification is created for the creator via `internal.notifications.createAndSend`
- Push notification sent to the creator's device
- Notification `data` includes `{ submissionId, leadId }` for deep linking

> **Note:** The `new_lead` notification type is defined in the schema but not yet wired into lead creation mutations. This will be connected when lead CRUD mutations are implemented.

---

## Analytics Integration

Lead generation metrics are tracked in the `analytics` table:
- `leadsGenerated` field on creator analytics (daily + monthly)
- When a lead is created, `incrementStat` should be called with `field: "leadsGenerated"`

Website-level lead tracking is in the `websiteAnalytics` table:
- `formSubmissions` — contact form submissions per website per day
- `contactClicks`, `whatsappClicks`, `phoneClicks` — engagement metrics

---

## Mobile App Screens (Planned)

### Lead List Screen
- Accessible from submission detail page ("View Leads" button)
- Grouped by status with count badges
- Pull-to-refresh (Convex reactivity handles real-time updates)
- Filter by status, sort by date

### Lead Detail Screen
- Lead info (name, phone, email, message, source)
- Status pipeline indicator (visual progress bar)
- Quick actions: Call, WhatsApp, Email
- Notes timeline
- "Update Status" button with status picker

### Lead Dashboard Widget
- On the main dashboard: "X new leads this week" summary card
- Tapping navigates to the lead list

---

## Data Flow

```
Visitor submits form on deployed website
    ↓
API endpoint creates lead in Convex (leads.create)
    ↓
Notification sent to creator (new_lead)
    ↓
Creator views lead in app
    ↓
Business owner contacts lead (status → contacted)
    ↓
Lead qualifies / converts / lost
    ↓
Analytics updated (leadsGenerated incremented)
```
