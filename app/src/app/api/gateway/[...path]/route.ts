import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, requests } from "@/db/schema";
import { hashApiKey } from "@/lib/auth";
import { enforce } from "@/lib/enforce";

/**
 * Gateway-style enforcement endpoint.
 *
 *   POST /api/gateway/any-path   (any path works — demo: curl-friendly echo)
 *   Header: Authorization: Bearer qk_live_…
 *
 * Response 200: { ok: true, results: [...] }        — request allowed & metered
 * Response 429: { error: "rate_limit_exceeded", … } — over a limit
 * Response 401: invalid / revoked / disabled key
 */

export async function POST(req: NextRequest) {
  const start = Date.now();
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  const fail = async (status: number, body: object) => {
    // Log the request for the dashboard (best effort). Note: failed-auth
    // requests (401) carry no projectId — the key is unknown or revoked, so
    // they cannot be attributed to a project and show only in the request log.
    await db
      .insert(requests)
      .values({
        path: req.nextUrl.pathname,
        method: req.method,
        status,
        latencyMs: Date.now() - start,
      })
      .catch(() => {});
    return NextResponse.json(body, { status });
  };

  if (!token) {
    return fail(401, { error: "unauthorized", message: "Missing bearer token" });
  }

  const keyRows = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, hashApiKey(token)), isNull(apiKeys.revokedAt)));

  const apiKey = keyRows[0];
  if (!apiKey || !apiKey.enabled) {
    return fail(401, { error: "unauthorized", message: "Invalid or revoked API key" });
  }

  const { allowed, results } = await enforce(apiKey.id);

  if (!allowed) {
    return fail(429, {
      error: "rate_limit_exceeded",
      message: "One or more usage limits exceeded",
      results,
    });
  }

  await db.insert(requests).values({
    apiKeyId: apiKey.id,
    projectId: apiKey.projectId,
    path: req.nextUrl.pathname,
    method: req.method,
    status: 200,
    latencyMs: Date.now() - start,
  });

  return NextResponse.json({
    ok: true,
    echo: {
      path: req.nextUrl.pathname,
      ts: new Date().toISOString(),
    },
    results,
  });
}

export const GET = POST;
