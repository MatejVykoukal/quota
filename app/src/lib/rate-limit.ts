import { sql, eq } from "drizzle-orm";
import { db } from "@/db";
import { authAttempts } from "@/db/schema";

/** Login rate limit: 10 failed attempts per 15 minutes per IP. */
const MAX_ATTEMPTS = 10;
const WINDOW_SECONDS = 15 * 60;

function currentWindowStart(now = new Date()): Date {
  const periodMs = WINDOW_SECONDS * 1000;
  return new Date(Math.floor(now.getTime() / periodMs) * periodMs);
}

/**
 * Check and record a login attempt. DB-backed (not in-memory) so the limit
 * holds across horizontally scaled instances and edge deployments.
 * Atomic upsert: increment only if the result stays within the limit.
 *
 * Returns false (and records nothing) when the IP is over the limit.
 */
export async function checkAndRecordLoginAttempt(ip: string): Promise<boolean> {
  const windowStart = currentWindowStart();

  const inserted = await db
    .insert(authAttempts)
    .values({ ip, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: authAttempts.ip,
      set: {
        count: sql`CASE WHEN ${authAttempts.windowStart} = ${windowStart.toISOString()}
                        THEN ${authAttempts.count} + 1 ELSE 1 END`,
        windowStart,
      },
      setWhere: sql`CASE WHEN ${authAttempts.windowStart} = ${windowStart.toISOString()}
                         THEN ${authAttempts.count} + 1 <= ${MAX_ATTEMPTS}
                         ELSE true END`,
    })
    .returning({ count: authAttempts.count });

  return inserted.length > 0;
}

/** Successful login clears the attempt counter for the IP. */
export async function clearLoginAttempts(ip: string): Promise<void> {
  await db.delete(authAttempts).where(eq(authAttempts.ip, ip));
}
