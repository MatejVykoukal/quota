import { sql } from "drizzle-orm";
import { db } from "@/db";
import { meters, usage, apiKeys, type Meter } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Compute the start of the current counting window for a meter.
 *  - rate meters: fixed slots of periodSeconds (e.g. 60 → :00, :60, …)
 *  - quota meters: start of UTC day or month
 */
export function currentWindowStart(meter: Meter, now = new Date()): Date {
  if (meter.kind === "rate") {
    const periodMs = (meter.periodSeconds ?? 60) * 1000;
    return new Date(Math.floor(now.getTime() / periodMs) * periodMs);
  }
  if (meter.period === "month") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export interface EnforcementResult {
  meterName: string;
  limit: number;
  used: number;
}

/**
 * Atomically check all meters for a key and increment counters for allowed
 * requests. Uses INSERT … ON CONFLICT DO UPDATE with a WHERE guard on the
 * limit, so concurrent requests can't overshoot.
 */
export async function enforce(
  apiKeyId: string,
  now = new Date(),
): Promise<{ allowed: boolean; results: EnforcementResult[] }> {
  const keyRows = await db
    .select({ projectId: apiKeys.projectId })
    .from(apiKeys)
    .where(eq(apiKeys.id, apiKeyId));
  if (!keyRows[0]) return { allowed: false, results: [] };

  const projectMeters = await db
    .select()
    .from(meters)
    .where(eq(meters.projectId, keyRows[0].projectId));

  const results: EnforcementResult[] = [];
  const incremented: { meter: Meter; windowStart: Date }[] = [];
  let allowed = true;

  for (const meter of projectMeters) {
    const windowStart = currentWindowStart(meter, now);

    // Increment only if the new count stays within the limit.
    const inserted = await db
      .insert(usage)
      .values({ apiKeyId, meterId: meter.id, windowStart, count: 1 })
      .onConflictDoUpdate({
        target: [usage.apiKeyId, usage.meterId, usage.windowStart],
        set: { count: sql`${usage.count} + 1` },
        setWhere: sql`${usage.count} + 1 <= ${meter.limit}`,
      })
      .returning({ count: usage.count });

    if (inserted[0]) {
      incremented.push({ meter, windowStart });
      results.push({
        meterName: meter.name,
        limit: meter.limit,
        used: inserted[0].count,
      });
    } else {
      // Over the limit — report current usage without incrementing.
      const current = await db
        .select({ count: usage.count })
        .from(usage)
        .where(
          sql`${usage.apiKeyId} = ${apiKeyId} AND ${usage.meterId} = ${meter.id}
              AND ${usage.windowStart} = ${windowStart.toISOString()}`,
        );
      results.push({
        meterName: meter.name,
        limit: meter.limit,
        used: current[0]?.count ?? meter.limit, // treat missing as full
      });
      allowed = false;
    }
  }

  // A rejected request consumes no quota — roll back any increments.
  if (!allowed) {
    for (const { meter, windowStart } of incremented) {
      await db
        .update(usage)
        .set({ count: sql`${usage.count} - 1` })
        .where(
          sql`${usage.apiKeyId} = ${apiKeyId} AND ${usage.meterId} = ${meter.id}
              AND ${usage.windowStart} = ${windowStart.toISOString()}`,
        );
    }
  }

  return { allowed, results };
}
