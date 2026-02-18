/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as airtable from "../airtable.js";
import type * as analytics from "../analytics.js";
import type * as analyticsJobs from "../analyticsJobs.js";
import type * as auditLogs from "../auditLogs.js";
import type * as creators from "../creators.js";
import type * as crons from "../crons.js";
import type * as earnings from "../earnings.js";
import type * as files from "../files.js";
import type * as generatedWebsites from "../generatedWebsites.js";
import type * as http from "../http.js";
import type * as leadNotes from "../leadNotes.js";
import type * as leads from "../leads.js";
import type * as notifications from "../notifications.js";
import type * as payoutMethods from "../payoutMethods.js";
import type * as r2 from "../r2.js";
import type * as referrals from "../referrals.js";
import type * as settings from "../settings.js";
import type * as storage from "../storage.js";
import type * as submissions from "../submissions.js";
import type * as websiteContent from "../websiteContent.js";
import type * as withdrawals from "../withdrawals.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  airtable: typeof airtable;
  analytics: typeof analytics;
  analyticsJobs: typeof analyticsJobs;
  auditLogs: typeof auditLogs;
  creators: typeof creators;
  crons: typeof crons;
  earnings: typeof earnings;
  files: typeof files;
  generatedWebsites: typeof generatedWebsites;
  http: typeof http;
  leadNotes: typeof leadNotes;
  leads: typeof leads;
  notifications: typeof notifications;
  payoutMethods: typeof payoutMethods;
  r2: typeof r2;
  referrals: typeof referrals;
  settings: typeof settings;
  storage: typeof storage;
  submissions: typeof submissions;
  websiteContent: typeof websiteContent;
  withdrawals: typeof withdrawals;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
