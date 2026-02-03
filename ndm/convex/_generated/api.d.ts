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
import type * as creators from "../creators.js";
import type * as files from "../files.js";
import type * as generatedWebsites from "../generatedWebsites.js";
import type * as r2 from "../r2.js";
import type * as storage from "../storage.js";
import type * as submissions from "../submissions.js";
import type * as websiteContent from "../websiteContent.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  creators: typeof creators;
  files: typeof files;
  generatedWebsites: typeof generatedWebsites;
  r2: typeof r2;
  storage: typeof storage;
  submissions: typeof submissions;
  websiteContent: typeof websiteContent;
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
