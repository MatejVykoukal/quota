import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, lt } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { requests } from '@/db/schema';
import { isAuthenticated } from '@/lib/auth';

const PAGE_SIZE = 50;

const paramsSchema = z.object({ id: z.uuid() });
const querySchema = z.object({
	before: z.coerce.date(),
});

export async function GET(
	req: NextRequest,
	props: { params: Promise<{ id: string }> },
) {
	if (!(await isAuthenticated())) {
		return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
	}

	const { id } = await props.params;
	const parsedId = paramsSchema.shape.id.safeParse(id);
	const before = querySchema.safeParse(
		Object.fromEntries(req.nextUrl.searchParams),
	);
	if (!parsedId.success || !before.success) {
		return NextResponse.json({ error: 'bad_request' }, { status: 400 });
	}

	const rows = await db
		.select()
		.from(requests)
		.where(
			and(
				eq(requests.projectId, parsedId.data),
				lt(requests.createdAt, before.data.before),
			),
		)
		.orderBy(desc(requests.createdAt))
		.limit(PAGE_SIZE);

	return NextResponse.json(
		rows.map((r) => ({
			id: r.id,
			createdAt: r.createdAt.toISOString(),
			method: r.method,
			status: r.status,
			path: r.path,
			latencyMs: r.latencyMs,
		})),
	);
}
