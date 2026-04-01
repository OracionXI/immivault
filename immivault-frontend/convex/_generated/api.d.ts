/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as appointmentAvailability_mutations from "../appointmentAvailability/mutations.js";
import type * as appointmentAvailability_queries from "../appointmentAvailability/queries.js";
import type * as appointmentRequests_mutations from "../appointmentRequests/mutations.js";
import type * as appointmentRequests_queries from "../appointmentRequests/queries.js";
import type * as appointments_jobs from "../appointments/jobs.js";
import type * as appointments_mutations from "../appointments/mutations.js";
import type * as appointments_queries from "../appointments/queries.js";
import type * as archival_actions from "../archival/actions.js";
import type * as archival_jobs from "../archival/jobs.js";
import type * as archival_mutations from "../archival/mutations.js";
import type * as archival_queries from "../archival/queries.js";
import type * as bankAccounts_mutations from "../bankAccounts/mutations.js";
import type * as bankAccounts_queries from "../bankAccounts/queries.js";
import type * as bankTransactions_mutations from "../bankTransactions/mutations.js";
import type * as bankTransactions_queries from "../bankTransactions/queries.js";
import type * as billing_actions from "../billing/actions.js";
import type * as billing_jobs from "../billing/jobs.js";
import type * as billing_mutations from "../billing/mutations.js";
import type * as billing_queries from "../billing/queries.js";
import type * as cases_mutations from "../cases/mutations.js";
import type * as cases_queries from "../cases/queries.js";
import type * as clients_mutations from "../clients/mutations.js";
import type * as clients_queries from "../clients/queries.js";
import type * as comments_mutations from "../comments/mutations.js";
import type * as comments_queries from "../comments/queries.js";
import type * as crons from "../crons.js";
import type * as dashboard_queries from "../dashboard/queries.js";
import type * as documents_actions from "../documents/actions.js";
import type * as documents_mutations from "../documents/mutations.js";
import type * as documents_queries from "../documents/queries.js";
import type * as env from "../env.js";
import type * as googleCalendar_actions from "../googleCalendar/actions.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_crypto from "../lib/crypto.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_rbac from "../lib/rbac.js";
import type * as lib_s3 from "../lib/s3.js";
import type * as lib_visibility from "../lib/visibility.js";
import type * as notifications_actions from "../notifications/actions.js";
import type * as notifications_jobs from "../notifications/jobs.js";
import type * as notifications_mutations from "../notifications/mutations.js";
import type * as notifications_queries from "../notifications/queries.js";
import type * as organisations_actions from "../organisations/actions.js";
import type * as organisations_jobs from "../organisations/jobs.js";
import type * as organisations_mutations from "../organisations/mutations.js";
import type * as organisations_queries from "../organisations/queries.js";
import type * as portal_actions from "../portal/actions.js";
import type * as portal_auth from "../portal/auth.js";
import type * as portal_jobs from "../portal/jobs.js";
import type * as portal_liveQueries from "../portal/liveQueries.js";
import type * as portal_mutations from "../portal/mutations.js";
import type * as portal_queries from "../portal/queries.js";
import type * as seed from "../seed.js";
import type * as staffAvailabilityExclusions_mutations from "../staffAvailabilityExclusions/mutations.js";
import type * as staffAvailabilityExclusions_queries from "../staffAvailabilityExclusions/queries.js";
import type * as staffAvailability_mutations from "../staffAvailability/mutations.js";
import type * as staffAvailability_queries from "../staffAvailability/queries.js";
import type * as tasks_mutations from "../tasks/mutations.js";
import type * as tasks_queries from "../tasks/queries.js";
import type * as users_actions from "../users/actions.js";
import type * as users_mutations from "../users/mutations.js";
import type * as users_queries from "../users/queries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "appointmentAvailability/mutations": typeof appointmentAvailability_mutations;
  "appointmentAvailability/queries": typeof appointmentAvailability_queries;
  "appointmentRequests/mutations": typeof appointmentRequests_mutations;
  "appointmentRequests/queries": typeof appointmentRequests_queries;
  "appointments/jobs": typeof appointments_jobs;
  "appointments/mutations": typeof appointments_mutations;
  "appointments/queries": typeof appointments_queries;
  "archival/actions": typeof archival_actions;
  "archival/jobs": typeof archival_jobs;
  "archival/mutations": typeof archival_mutations;
  "archival/queries": typeof archival_queries;
  "bankAccounts/mutations": typeof bankAccounts_mutations;
  "bankAccounts/queries": typeof bankAccounts_queries;
  "bankTransactions/mutations": typeof bankTransactions_mutations;
  "bankTransactions/queries": typeof bankTransactions_queries;
  "billing/actions": typeof billing_actions;
  "billing/jobs": typeof billing_jobs;
  "billing/mutations": typeof billing_mutations;
  "billing/queries": typeof billing_queries;
  "cases/mutations": typeof cases_mutations;
  "cases/queries": typeof cases_queries;
  "clients/mutations": typeof clients_mutations;
  "clients/queries": typeof clients_queries;
  "comments/mutations": typeof comments_mutations;
  "comments/queries": typeof comments_queries;
  crons: typeof crons;
  "dashboard/queries": typeof dashboard_queries;
  "documents/actions": typeof documents_actions;
  "documents/mutations": typeof documents_mutations;
  "documents/queries": typeof documents_queries;
  env: typeof env;
  "googleCalendar/actions": typeof googleCalendar_actions;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/crypto": typeof lib_crypto;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/rbac": typeof lib_rbac;
  "lib/s3": typeof lib_s3;
  "lib/visibility": typeof lib_visibility;
  "notifications/actions": typeof notifications_actions;
  "notifications/jobs": typeof notifications_jobs;
  "notifications/mutations": typeof notifications_mutations;
  "notifications/queries": typeof notifications_queries;
  "organisations/actions": typeof organisations_actions;
  "organisations/jobs": typeof organisations_jobs;
  "organisations/mutations": typeof organisations_mutations;
  "organisations/queries": typeof organisations_queries;
  "portal/actions": typeof portal_actions;
  "portal/auth": typeof portal_auth;
  "portal/jobs": typeof portal_jobs;
  "portal/liveQueries": typeof portal_liveQueries;
  "portal/mutations": typeof portal_mutations;
  "portal/queries": typeof portal_queries;
  seed: typeof seed;
  "staffAvailabilityExclusions/mutations": typeof staffAvailabilityExclusions_mutations;
  "staffAvailabilityExclusions/queries": typeof staffAvailabilityExclusions_queries;
  "staffAvailability/mutations": typeof staffAvailability_mutations;
  "staffAvailability/queries": typeof staffAvailability_queries;
  "tasks/mutations": typeof tasks_mutations;
  "tasks/queries": typeof tasks_queries;
  "users/actions": typeof users_actions;
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
