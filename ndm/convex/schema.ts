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
    createdAt: v.optional(v.number()),
    referralCode: v.optional(v.string()),
    role: v.optional(v.string()),
    status: v.optional(v.string()),
    totalEarnings: v.optional(v.number()),
  }).index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_referral_code", ["referralCode"]),

  submissions: defineTable({
    creatorId: v.id("creators"),
    businessName: v.string(),
    businessType: v.string(),
    ownerName: v.string(),
    ownerPhone: v.string(),
    ownerEmail: v.optional(v.string()),
    address: v.string(),
    city: v.string(),
    photos: v.optional(v.array(v.string())),
    hasProducts: v.optional(v.boolean()), // Whether this business has products (affects expected photo count)
    videoStorageId: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    audioStorageId: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
    transcript: v.optional(v.string()),
    transcriptionStatus: v.optional(v.string()), // processing, complete, failed, skipped
    transcriptionError: v.optional(v.string()),
    status: v.string(), // draft, pending, approved, rejected, website_generated, deployed, paid, in_review
    creatorPayout: v.optional(v.number()),
    amount: v.optional(v.number()),
    airtableRecordId: v.optional(v.string()), // Airtable record ID (starts with "rec")
    airtableSyncStatus: v.optional(v.string()), // pending_push, pushed, content_received, synced, error
  }).index("by_creator_id", ["creatorId"])
    .index("by_status", ["status"])
    .index("by_airtable_sync", ["airtableSyncStatus"]),
    .index("by_creator_status", ["creatorId", "status"])
    .index("by_city", ["city"]),


  generatedWebsites: defineTable({
    submissionId: v.id("submissions"),
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
    customizations: v.optional(v.any()),
    extractedContent: v.optional(v.any()),
    cfPagesProjectName: v.optional(v.string()),
  }).index("by_submission_id", ["submissionId"])
    .index("by_status", ["status"]),

  websiteContent: defineTable({
    submissionId: v.optional(v.id("submissions")),
    websiteId: v.optional(v.id("generatedWebsites")),
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
    aboutContent: v.optional(v.string()), // AI-generated about section content
    // Featured section
    featuredHeadline: v.optional(v.string()),
    featuredSubHeadline: v.optional(v.string()),
    featuredSubheadline: v.optional(v.string()), // lowercase variant
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
    servicesDescription: v.optional(v.string()), // AI-generated services description
    // Contact section
    contactCta: v.optional(v.string()), // AI-generated contact call-to-action
    // Business info
    businessName: v.optional(v.string()),
    tagline: v.optional(v.string()),
    tone: v.optional(v.string()),
    // Services and other content
    services: v.optional(v.any()),
    images: v.optional(v.any()),
    enhancedImages: v.optional(v.any()),
    contact: v.optional(v.any()),
    contactInfo: v.optional(v.any()),
    customizations: v.optional(v.any()),
    uniqueSellingPoints: v.optional(v.any()),
    visibility: v.optional(v.any()),
    socialLinks: v.optional(v.any()),
    updatedAt: v.optional(v.number()),
    // Airtable AI-enhanced images (structured with field names preserved)
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
    // Airtable sync tracking
    airtableSyncedAt: v.optional(v.number()),
  }).index("by_submission_id", ["submissionId"]),
});
