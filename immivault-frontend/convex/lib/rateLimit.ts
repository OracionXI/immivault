import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";

/**
 * Fixed-window rate limiter backed by the `rateLimits` table.
 *
 * Each key has exactly ONE counter document. The counter resets when the
 * current time moves past the window boundary. This is safe from race
 * conditions because Convex mutations use OCC (optimistic concurrency
 * control): if two mutations patch the same document concurrently, one
 * automatically retries with the updated count.
 *
 * Migration note: old sliding-window installs may have multiple rows per key.
 * On first call after deployment, all rows for that key are deleted and a
 * fresh counter is created. Existing rate-limit history is reset once only.
 *
 * @param ctx         - Convex mutation context
 * @param key         - Unique identifier for the action+scope, e.g. "inviteStaff:<orgId>"
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
  // Round down to the nearest window boundary so all calls within the same
  // window share the same counter document.
  const windowStart = Math.floor(now / windowMs) * windowMs;

  const records = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .collect();

  // ── Migration: collapse legacy per-request rows into a single counter ────
  // If there is more than one row for this key, the table was written by the
  // old sliding-window implementation. Delete all rows and start fresh.
  if (records.length > 1) {
    await Promise.all(records.map((r) => ctx.db.delete(r._id)));
    await ctx.db.insert("rateLimits", { key, timestamp: windowStart, count: 1 });
    return;
  }

  const record = records[0];

  if (!record) {
    // First call ever for this key.
    await ctx.db.insert("rateLimits", { key, timestamp: windowStart, count: 1 });
    return;
  }

  if (record.timestamp !== windowStart) {
    // The window has rolled over — reset the counter for the new window.
    await ctx.db.patch(record._id, { timestamp: windowStart, count: 1 });
    return;
  }

  // Same window — check count and increment atomically.
  const currentCount = record.count ?? 1;
  if (currentCount >= maxRequests) {
    throw new ConvexError({
      code: "RATE_LIMITED",
      message: "Too many requests. Please try again later.",
    });
  }
  await ctx.db.patch(record._id, { count: currentCount + 1 });
}
