import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  creators: defineTable({
    clerkId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    middleName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
    balance: v.optional(v.number()),
    totalEarnings: v.optional(v.number()),
    totalWithdrawn: v.optional(v.number()),
    submissionCount: v.optional(v.number()),
    level: v.optional(v.number()), // Gamification level (1 = starter, 2 = active, 3 = pro, etc.)
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    lastActiveAt: v.optional(v.number()),
    referralCode: v.optional(v.string()),
    referredByCode: v.optional(v.string()), // Referral code used during signup
    role: v.optional(v.string()),
    status: v.optional(v.string()),
    profileImage: v.optional(v.string()), // R2 public URL for profile photo
  }).index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_referral_code", ["referralCode"])
    .index("by_status", ["status"]),

  submissions: defineTable({
    creatorId: v.id("creators"),
    businessName: v.string(),
    businessType: v.string(),
    businessDescription: v.optional(v.string()), // AI-generated from transcript
    ownerName: v.string(),
    ownerPhone: v.string(),
    ownerEmail: v.optional(v.string()),
    address: v.string(),
    city: v.string(),
    province: v.optional(v.string()),
    barangay: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    coordinates: v.optional(v.object({ // GPS location of the business
      lat: v.number(),
      lng: v.number(),
    })),
    photos: v.optional(v.array(v.string())),
    hasProducts: v.optional(v.boolean()), // Whether this business has products (affects expected photo count)
    videoStorageId: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    audioStorageId: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
    transcript: v.optional(v.string()),
    transcriptionStatus: v.optional(v.string()), // processing, complete, failed, skipped
    transcriptionError: v.optional(v.string()),
    aiGeneratedContent: v.optional(v.any()), // AI-extracted content from transcript (services, USPs, etc.)
    status: v.string(), // draft, submitted, approved, rejected, website_generated, deployed, paid, in_review
    rejectionReason: v.optional(v.string()),
    reviewedBy: v.optional(v.string()), // Admin Clerk ID who reviewed
    reviewedAt: v.optional(v.number()), // When the review happened
    websiteUrl: v.optional(v.string()),
    creatorPayout: v.optional(v.number()),
    platformFee: v.optional(v.number()), // Platform fee charged to business owner
    amount: v.optional(v.number()),
    airtableRecordId: v.optional(v.string()), // Airtable record ID (starts with "rec")
    airtableSyncStatus: v.optional(v.string()), // pending_push, pushed, content_received, synced, error
  }).index("by_creator_id", ["creatorId"])
    .index("by_status", ["status"])
    .index("by_airtable_sync", ["airtableSyncStatus"])
    .index("by_creator_status", ["creatorId", "status"])
    .index("by_city", ["city"]),


  generatedWebsites: defineTable({
    submissionId: v.id("submissions"),
    // Website generation & deployment
    html: v.optional(v.string()),
    htmlContent: v.optional(v.string()),
    css: v.optional(v.string()),
    cssContent: v.optional(v.string()),
    deployedUrl: v.optional(v.string()),
    publishedUrl: v.optional(v.string()),
    status: v.optional(v.string()),
    templateName: v.optional(v.string()),
    netlifySiteId: v.optional(v.string()),
    htmlStorageId: v.optional(v.string()),
    publishedAt: v.optional(v.number()),
    extractedContent: v.optional(v.any()),
    cfPagesProjectName: v.optional(v.string()),
    // === Content fields (consolidated from websiteContent) ===
    // Hero section
    heroTitle: v.optional(v.string()),
    heroSubtitle: v.optional(v.string()),
    heroHeadline: v.optional(v.string()),
    heroSubHeadline: v.optional(v.string()),
    heroBadgeText: v.optional(v.string()),
    heroCtaLabel: v.optional(v.string()),
    heroCtaLink: v.optional(v.string()),
    heroTestimonial: v.optional(v.any()),
    // About section
    aboutText: v.optional(v.string()),
    aboutDescription: v.optional(v.string()),
    aboutHeadline: v.optional(v.string()),
    aboutTagline: v.optional(v.string()),
    aboutTags: v.optional(v.any()),
    aboutContent: v.optional(v.string()),
    // Featured section
    featuredHeadline: v.optional(v.string()),
    featuredSubHeadline: v.optional(v.string()),
    featuredSubheadline: v.optional(v.string()),
    featuredImages: v.optional(v.any()),
    featuredProducts: v.optional(v.any()),
    // Footer section
    footerDescription: v.optional(v.string()),
    // Navbar section
    navbarHeadline: v.optional(v.string()),
    navbarCtaLabel: v.optional(v.string()),
    navbarCtaLink: v.optional(v.string()),
    navbarCtaText: v.optional(v.string()),
    navbarLinks: v.optional(v.any()),
    // Services section
    servicesHeadline: v.optional(v.string()),
    servicesSubheadline: v.optional(v.string()),
    servicesDescription: v.optional(v.string()),
    // Contact section
    contactCta: v.optional(v.string()),
    // Business info
    businessName: v.optional(v.string()),
    tagline: v.optional(v.string()),
    tone: v.optional(v.string()),
    // Services and other content
    services: v.optional(v.any()),
    images: v.optional(v.any()),
    contact: v.optional(v.any()),
    contactInfo: v.optional(v.any()),
    customizations: v.optional(v.any()),
    uniqueSellingPoints: v.optional(v.any()),
    visibility: v.optional(v.any()),
    socialLinks: v.optional(v.any()),
    updatedAt: v.optional(v.number()),
    // Airtable AI-enhanced images
    enhancedImages: v.optional(v.object({
      headshot: v.optional(v.object({
        url: v.optional(v.string()),
        storageId: v.optional(v.id("_storage")),
      })),
      interior_1: v.optional(v.object({
        url: v.optional(v.string()),
        storageId: v.optional(v.id("_storage")),
      })),
      interior_2: v.optional(v.object({
        url: v.optional(v.string()),
        storageId: v.optional(v.id("_storage")),
      })),
      exterior: v.optional(v.object({
        url: v.optional(v.string()),
        storageId: v.optional(v.id("_storage")),
      })),
      product_1: v.optional(v.object({
        url: v.optional(v.string()),
        storageId: v.optional(v.id("_storage")),
      })),
      product_2: v.optional(v.object({
        url: v.optional(v.string()),
        storageId: v.optional(v.id("_storage")),
      })),
    })),
    // Domain settings
    subdomain: v.optional(v.string()), // e.g., "juans-bakery" → juans-bakery.negosyo.digital
    customDomain: v.optional(v.string()), // e.g., "www.juansbakery.com"
    // Airtable sync tracking
    airtableSyncedAt: v.optional(v.number()),
  }).index("by_submission_id", ["submissionId"])
    .index("by_status", ["status"]),

  // DEPRECATED: websiteContent is consolidated into generatedWebsites.
  // Kept for backwards compatibility with existing data. Do not write new data here.
  websiteContent: defineTable({
    submissionId: v.optional(v.id("submissions")),
    websiteId: v.optional(v.id("generatedWebsites")),
    heroTitle: v.optional(v.string()),
    heroSubtitle: v.optional(v.string()),
    heroHeadline: v.optional(v.string()),
    heroSubHeadline: v.optional(v.string()),
    heroBadgeText: v.optional(v.string()),
    heroCtaLabel: v.optional(v.string()),
    heroCtaLink: v.optional(v.string()),
    heroTestimonial: v.optional(v.any()),
    aboutText: v.optional(v.string()),
    aboutDescription: v.optional(v.string()),
    aboutHeadline: v.optional(v.string()),
    aboutTagline: v.optional(v.string()),
    aboutTags: v.optional(v.any()),
    aboutContent: v.optional(v.string()),
    featuredHeadline: v.optional(v.string()),
    featuredSubHeadline: v.optional(v.string()),
    featuredSubheadline: v.optional(v.string()),
    featuredImages: v.optional(v.any()),
    featuredProducts: v.optional(v.any()),
    footerDescription: v.optional(v.string()),
    navbarHeadline: v.optional(v.string()),
    navbarCtaLabel: v.optional(v.string()),
    navbarCtaLink: v.optional(v.string()),
    navbarCtaText: v.optional(v.string()),
    navbarLinks: v.optional(v.any()),
    servicesHeadline: v.optional(v.string()),
    servicesSubheadline: v.optional(v.string()),
    servicesDescription: v.optional(v.string()),
    contactCta: v.optional(v.string()),
    businessName: v.optional(v.string()),
    tagline: v.optional(v.string()),
    tone: v.optional(v.string()),
    services: v.optional(v.any()),
    images: v.optional(v.any()),
    contact: v.optional(v.any()),
    contactInfo: v.optional(v.any()),
    customizations: v.optional(v.any()),
    uniqueSellingPoints: v.optional(v.any()),
    visibility: v.optional(v.any()),
    socialLinks: v.optional(v.any()),
    updatedAt: v.optional(v.number()),
    enhancedImages: v.optional(v.object({
      headshot: v.optional(v.object({
        url: v.optional(v.string()),
        storageId: v.optional(v.id("_storage")),
      })),
      interior_1: v.optional(v.object({
        url: v.optional(v.string()),
        storageId: v.optional(v.id("_storage")),
      })),
      interior_2: v.optional(v.object({
        url: v.optional(v.string()),
        storageId: v.optional(v.id("_storage")),
      })),
      exterior: v.optional(v.object({
        url: v.optional(v.string()),
        storageId: v.optional(v.id("_storage")),
      })),
      product_1: v.optional(v.object({
        url: v.optional(v.string()),
        storageId: v.optional(v.id("_storage")),
      })),
      product_2: v.optional(v.object({
        url: v.optional(v.string()),
        storageId: v.optional(v.id("_storage")),
      })),
    })),
    airtableSyncedAt: v.optional(v.number()),
  }).index("by_submission_id", ["submissionId"]),

  earnings: defineTable({
    creatorId: v.id("creators"),
    submissionId: v.id("submissions"),
    amount: v.number(),
    type: v.union(v.literal("submission_approved"), v.literal("referral_bonus"), v.literal("lead_bonus")),
    status: v.union(v.literal("pending"), v.literal("available"), v.literal("withdrawn")),
    createdAt: v.number(),
  }).index("by_creator", ["creatorId"])
    .index("by_submission", ["submissionId"]),

  withdrawals: defineTable({
    creatorId: v.id("creators"),
    amount: v.number(),
    payoutMethod: v.union(v.literal("gcash"), v.literal("maya"), v.literal("bank_transfer")),
    accountDetails: v.string(),
    status: v.union(v.literal("pending"), v.literal("processing"), v.literal("completed"), v.literal("failed")),
    processedAt: v.optional(v.number()),
    transactionRef: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_creator", ["creatorId"])
    .index("by_status", ["status"]),

  payoutMethods: defineTable({
    creatorId: v.id("creators"),
    type: v.union(v.literal("gcash"), v.literal("maya"), v.literal("bank_transfer")),
    accountName: v.string(),
    accountNumber: v.string(),
    isDefault: v.boolean(),
  }).index("by_creator", ["creatorId"]),

  leads: defineTable({
    submissionId: v.id("submissions"),
    creatorId: v.id("creators"),
    businessOwnerId: v.optional(v.string()),
    source: v.union(v.literal("website"), v.literal("qr_code"), v.literal("direct")),
    name: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    message: v.optional(v.string()),
    status: v.union(v.literal("new"), v.literal("contacted"), v.literal("qualified"), v.literal("converted"), v.literal("lost")),
    createdAt: v.number(),
  }).index("by_submission", ["submissionId"])
    .index("by_creator", ["creatorId"])
    .index("by_status", ["status"]),

  leadNotes: defineTable({
    leadId: v.id("leads"),
    creatorId: v.id("creators"),
    content: v.string(),
    createdAt: v.number(),
  }).index("by_lead", ["leadId"]),

  notifications: defineTable({
    creatorId: v.id("creators"),
    type: v.union(
      v.literal("submission_approved"),
      v.literal("submission_rejected"),
      v.literal("new_lead"),
      v.literal("payout_sent"),
      v.literal("website_live"),
      v.literal("submission_created"),
      v.literal("profile_updated"),
      v.literal("password_changed"),
      v.literal("system"),
    ),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()), // Flexible payload (submissionId, leadId, etc.)
    read: v.boolean(),
    sentAt: v.number(),
  }).index("by_creator", ["creatorId"])
    .index("by_creator_unread", ["creatorId", "read"]),

  pushTokens: defineTable({
    creatorId: v.id("creators"),
    token: v.string(),
    platform: v.union(v.literal("ios"), v.literal("android"), v.literal("web")),
    active: v.boolean(),
  }).index("by_creator", ["creatorId"])
    .index("by_token", ["token"]),

  referrals: defineTable({
    referrerId: v.id("creators"), // Creator who shared the referral code
    referredId: v.id("creators"), // Creator who signed up with the code
    referralCode: v.string(), // The code that was used
    status: v.union(
      v.literal("pending"),    // Referred user signed up but no approved submission yet
      v.literal("qualified"),  // Referred user's first submission was approved
      v.literal("paid"),       // Referral bonus has been paid out
    ),
    bonusAmount: v.optional(v.number()), // Bonus amount in PHP (set when qualified)
    qualifiedAt: v.optional(v.number()), // When the referral qualified
    paidAt: v.optional(v.number()), // When the bonus was paid out
    createdAt: v.number(),
  }).index("by_referrer", ["referrerId"])
    .index("by_referred", ["referredId"])
    .index("by_status", ["status"]),

  analytics: defineTable({
    creatorId: v.id("creators"),
    period: v.string(), // "2026-02" for monthly, "2026-02-17" for daily
    periodType: v.union(v.literal("daily"), v.literal("monthly")),
    submissionsCount: v.number(),
    approvedCount: v.number(),
    rejectedCount: v.number(),
    leadsGenerated: v.number(),
    earningsTotal: v.number(),
    websitesLive: v.number(),
    referralsCount: v.number(),
    updatedAt: v.number(),
  }).index("by_creator_period", ["creatorId", "periodType", "period"])
    .index("by_period", ["periodType", "period"]),

  websiteAnalytics: defineTable({
    submissionId: v.id("submissions"),
    date: v.string(), // "2026-02-17"
    pageViews: v.number(),
    uniqueVisitors: v.number(),
    contactClicks: v.number(),
    whatsappClicks: v.number(),
    phoneClicks: v.number(),
    formSubmissions: v.number(),
    updatedAt: v.number(),
  }).index("by_submission_date", ["submissionId", "date"])
    .index("by_date", ["date"]),

  auditLogs: defineTable({
    adminId: v.string(), // Clerk user ID of the admin performing the action
    action: v.union(
      v.literal("submission_approved"),
      v.literal("submission_rejected"),
      v.literal("website_generated"),
      v.literal("website_deployed"),
      v.literal("payment_sent"),
      v.literal("submission_deleted"),
      v.literal("creator_updated"),
      v.literal("manual_override"),
    ),
    targetType: v.union(
      v.literal("submission"),
      v.literal("creator"),
      v.literal("website"),
      v.literal("withdrawal"),
    ),
    targetId: v.string(), // ID of the affected record
    metadata: v.optional(v.any()), // Additional context (reason, old/new values, etc.)
    timestamp: v.number(),
  }).index("by_admin", ["adminId"])
    .index("by_target", ["targetType", "targetId"])
    .index("by_action", ["action"])
    .index("by_timestamp", ["timestamp"]),

  settings: defineTable({
    key: v.string(), // Unique setting key (e.g., "referral_bonus_amount", "min_withdrawal", "platform_fee_percent")
    value: v.any(), // Setting value (number, string, boolean, object)
    description: v.optional(v.string()), // Human-readable description
    updatedAt: v.number(),
    updatedBy: v.optional(v.string()), // Admin Clerk ID who last updated
  }).index("by_key", ["key"]),
});
