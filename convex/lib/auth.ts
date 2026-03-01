import {
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import { mutation, query } from "../_generated/server";
import { ConvexError } from "convex/values";

/**
 * Authenticated query wrapper.
 * Looks up the Convex user record from the JWT tokenIdentifier and injects
 * `ctx.user` into every handler. Throws if the caller is not authenticated
 * or if their user profile does not exist in the database.
 *
 * Usage:
 *   export const myQuery = authenticatedQuery({ args: {}, handler: async (ctx) => ctx.user });
 */
export const authenticatedQuery = customQuery(
  query,
  {
    args: {},
    input: async (ctx) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated." });
      }

      const user = await ctx.db
        .query("users")
        .withIndex("by_token", (q) =>
          q.eq("tokenIdentifier", identity.tokenIdentifier)
        )
        .unique();

      if (!user) {
        throw new ConvexError({
          code: "USER_NOT_FOUND",
          message: "User profile not found. Please contact support.",
        });
      }

      return { ctx: { ...ctx, user }, args: {} };
    },
  }
);

/**
 * Authenticated mutation wrapper.
 * Same as authenticatedQuery but for state-changing operations.
 *
 * Usage:
 *   export const myMutation = authenticatedMutation({ args: {}, handler: async (ctx) => { ... } });
 */
export const authenticatedMutation = customMutation(
  mutation,
  {
    args: {},
    input: async (ctx) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated." });
      }

      const user = await ctx.db
        .query("users")
        .withIndex("by_token", (q) =>
          q.eq("tokenIdentifier", identity.tokenIdentifier)
        )
        .unique();

      if (!user) {
        throw new ConvexError({
          code: "USER_NOT_FOUND",
          message: "User profile not found. Please contact support.",
        });
      }

      return { ctx: { ...ctx, user }, args: {} };
    },
  }
);
