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
 * Resolve which scope a usage row belongs to for the given meter.
 *  - "key" scope     → the API key itself
 *  - "project" scope → the project the key belongs to
 */
function scopeColumns(
  meter: Meter,
  apiKeyId: string,
  projectId: string,
): { apiKeyId: string | null; projectId: string | null } {
  return meter.scope === "project"
    ? { apiKeyId: null, projectId }
    : { apiKeyId, projectId: null };
}

/**
 * Atomically check all meters for a key and increment counters for allowed
 * requests. Uses INSERT … ON CONFLICT DO UPDATE with a WHERE guard on the
 * limit, so concurrent requests can't overshoot.
 *
 * The conflict target must match the expression index
 * usage_scope_window_idx (meter_id, window_start, coalesce(api_key_id,
 * project_id)) — both scopes share one upsert path.
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
  const projectId = keyRows[0].projectId;

  const projectMeters = await db
    .select()
    .from(meters)
    .where(eq(meters.projectId, projectId));

  const results: EnforcementResult[] = [];
  const incremented: { scope: ReturnType<typeof scopeColumns>; meterId: string; windowStart: Date }[] = [];
  let allowed = true;

  for (const meter of projectMeters) {
    const windowStart = currentWindowStart(meter, now);
    const scope = scopeColumns(meter, apiKeyId, projectId);

    // Increment only if the new count stays within the limit.
    // Raw SQL: the conflict target is an expression index
    // (coalesce(api_key_id, project_id)), which drizzle's typed
    // onConflictDoUpdate cannot express. Values are still bound as params.
    const inserted = await db.execute<{ count: string }>(sql`
      INSERT INTO usage (meter_id, api_key_id, project_id, window_start, count)
      VALUES (${meter.id}, ${scope.apiKeyId}, ${scope.projectId}, ${windowStart.toISOString()}, 1)
      ON CONFLICT (meter_id, window_start, coalesce(api_key_id, project_id))
      DO UPDATE SET count = usage.count + 1
        WHERE usage.count + 1 <= ${meter.limit}
      RETURNING count
    `);

    if (inserted.rows[0]) {
      incremented.push({ scope, meterId: meter.id, windowStart });
      results.push({
        meterName: meter.name,
        limit: meter.limit,
        used: Number(inserted.rows[0].count),
      });
    } else {
      // Over the limit — report current usage without incrementing.
      const current = await db
        .select({ count: usage.count })
        .from(usage)
        .where(
          sql`${usage.meterId} = ${meter.id}
              AND ${usage.windowStart} = ${windowStart.toISOString()}
              AND coalesce(${usage.apiKeyId}, ${usage.projectId}) = coalesce(${scope.apiKeyId}::uuid, ${scope.projectId}::uuid)`,
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
    for (const { scope, meterId, windowStart } of incremented) {
      await db
        .update(usage)
        .set({ count: sql`${usage.count} - 1` })
        .where(
          sql`${usage.meterId} = ${meterId}
              AND ${usage.windowStart} = ${windowStart.toISOString()}
              AND coalesce(${usage.apiKeyId}, ${usage.projectId}) = coalesce(${scope.apiKeyId}::uuid, ${scope.projectId}::uuid)`,
        );
    }
  }

  return { allowed, results };
}
