import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";

/**
 * Sliding-window rate limiter backed by the `rateLimits` table.
 * Throws RATE_LIMITED if the caller exceeds `maxRequests` within `windowMs`.
 * Also cleans up expired records to keep the table lean.
 *
 * @param ctx   - Convex mutation context
 * @param key   - Unique identifier for the action+scope, e.g. "inviteStaff:<orgId>"
 * @param maxRequests - Max allowed calls within the window
 * @param windowMs    - Window size in milliseconds
 */
export async function checkRateLimit(
  ctx: MutationCtx,
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<void> {
  const now = Date.now();
  const windowStart = now - windowMs;

  const records = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .collect();

  const inWindow = records.filter((r) => r.timestamp >= windowStart);

  if (inWindow.length >= maxRequests) {
    throw new ConvexError({
      code: "RATE_LIMITED",
      message: "Too many requests. Please try again later.",
    });
  }

  // Record this call
  await ctx.db.insert("rateLimits", { key, timestamp: now });

  // Clean up expired records (keeps table lean — fire and forget within transaction)
  for (const r of records.filter((r) => r.timestamp < windowStart)) {
    await ctx.db.delete(r._id);
  }
}
