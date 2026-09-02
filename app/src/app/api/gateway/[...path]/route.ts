import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { apiKeys, requests } from '@/db/schema';
import { hashApiKey } from '@/lib/auth';
import { enforce } from '@/lib/enforce';

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
	const auth = req.headers.get('authorization') ?? '';
	const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

	const fail = async (
		status: number,
		body: object,
		key?: typeof apiKeys.$inferSelect,
	) => {
		// Log the request for the dashboard (best effort). Attribution: 429s
		// and 401s with a recognizable key carry its ids; only 401s with an
		// unknown key stay unattributed.
		await db
			.insert(requests)
			.values({
				apiKeyId: key?.id ?? null,
				projectId: key?.projectId ?? null,
				path: req.nextUrl.pathname,
				method: req.method,
				status,
				latencyMs: Date.now() - start,
			})
			.catch(() => {});
		return NextResponse.json(body, { status });
	};

	if (!token) {
		return fail(401, {
			error: 'unauthorized',
			message: 'Missing bearer token',
		});
	}

	// Look the key up regardless of status, so revoked/disabled keys can be
	// attributed (and told why they were rejected) while unknown ones cannot.
	const keyRows = await db
		.select()
		.from(apiKeys)
		.where(eq(apiKeys.keyHash, hashApiKey(token)));

	const apiKey = keyRows[0];
	if (!apiKey) {
		return fail(401, {
			error: 'unauthorized',
			message: 'Invalid API key',
		});
	}
	if (apiKey.revokedAt) {
		return fail(
			401,
			{ error: 'unauthorized', message: 'API key has been revoked' },
			apiKey,
		);
	}
	if (!apiKey.enabled) {
		return fail(
			401,
			{ error: 'unauthorized', message: 'API key is disabled' },
			apiKey,
		);
	}

	const { allowed, results } = await enforce(apiKey.id);

	if (!allowed) {
		return fail(
			429,
			{
				error: 'rate_limit_exceeded',
				message: 'One or more usage limits exceeded',
				results,
			},
			apiKey,
		);
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
