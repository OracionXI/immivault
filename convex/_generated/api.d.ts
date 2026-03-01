/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as appointments_mutations from "../appointments/mutations.js";
import type * as appointments_queries from "../appointments/queries.js";
import type * as billing_mutations from "../billing/mutations.js";
import type * as billing_queries from "../billing/queries.js";
import type * as cases_mutations from "../cases/mutations.js";
import type * as cases_queries from "../cases/queries.js";
import type * as clients_mutations from "../clients/mutations.js";
import type * as clients_queries from "../clients/queries.js";
import type * as comments_mutations from "../comments/mutations.js";
import type * as comments_queries from "../comments/queries.js";
import type * as dashboard_queries from "../dashboard/queries.js";
import type * as documents_mutations from "../documents/mutations.js";
import type * as documents_queries from "../documents/queries.js";
import type * as env from "../env.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as organisations_mutations from "../organisations/mutations.js";
import type * as organisations_queries from "../organisations/queries.js";
import type * as seed from "../seed.js";
import type * as tasks_mutations from "../tasks/mutations.js";
import type * as tasks_queries from "../tasks/queries.js";
import type * as users_mutations from "../users/mutations.js";
import type * as users_queries from "../users/queries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "appointments/mutations": typeof appointments_mutations;
  "appointments/queries": typeof appointments_queries;
  "billing/mutations": typeof billing_mutations;
  "billing/queries": typeof billing_queries;
  "cases/mutations": typeof cases_mutations;
  "cases/queries": typeof cases_queries;
  "clients/mutations": typeof clients_mutations;
  "clients/queries": typeof clients_queries;
  "comments/mutations": typeof comments_mutations;
  "comments/queries": typeof comments_queries;
  "dashboard/queries": typeof dashboard_queries;
  "documents/mutations": typeof documents_mutations;
  "documents/queries": typeof documents_queries;
  env: typeof env;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "organisations/mutations": typeof organisations_mutations;
  "organisations/queries": typeof organisations_queries;
  seed: typeof seed;
  "tasks/mutations": typeof tasks_mutations;
  "tasks/queries": typeof tasks_queries;
  "users/mutations": typeof users_mutations;
  "users/queries": typeof users_queries;
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
