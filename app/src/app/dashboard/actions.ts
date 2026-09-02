'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/db';
import { meters, projects } from '@/db/schema';

const createProjectSchema = z.object({
	name: z.string().trim().min(1, 'Name is required').max(100),
	description: z
		.string()
		.trim()
		.max(300, 'Description must be at most 300 characters')
		.optional(),
});

export async function createProject(formData: FormData) {
	const parsed = createProjectSchema.safeParse({
		name: formData.get('name'),
		description: formData.get('description') || undefined,
	});
	if (!parsed.success) {
		return { ok: false as const, error: parsed.error.issues[0].message };
	}

	const [project] = await db
		.insert(projects)
		.values({ name: parsed.data.name, description: parsed.data.description })
		.returning({ id: projects.id });

	revalidatePath('/dashboard');
	redirect(`/dashboard/projects/${project.id}`);
}

const meterBaseSchema = z.object({
	name: z.string().trim().min(1, 'Name is required').max(100),
	kind: z.enum(['rate', 'quota']),
	scope: z.enum(['key', 'project']),
	limit: z.coerce
		.number()
		.int('Limit must be a whole number')
		.min(1, 'Limit must be at least 1')
		.max(1_000_000, 'Limit is too large'),
	periodSeconds: z.coerce.number().int().min(1).max(86_400).optional(),
	period: z.enum(['day', 'month']).optional(),
});

export interface AddMeterResult {
	ok: boolean;
	error?: string;
}

export async function addMeter(
	projectId: string,
	_prev: AddMeterResult | null,
	formData: FormData,
): Promise<AddMeterResult> {
	if (!z.string().uuid().safeParse(projectId).success) {
		return { ok: false, error: 'Invalid project' };
	}

	const parsed = meterBaseSchema.safeParse({
		name: formData.get('name'),
		kind: formData.get('kind'),
		scope: formData.get('scope'),
		limit: formData.get('limit'),
		periodSeconds: formData.get('periodSeconds') || undefined,
		period: formData.get('period') || undefined,
	});
	if (!parsed.success) {
		return { ok: false, error: parsed.error.issues[0].message };
	}

	// kind-specific fields must match the kind
	const { kind, periodSeconds, period } = parsed.data;
	if (kind === 'rate' && !periodSeconds) {
		return { ok: false, error: 'Rate meters need a period (seconds)' };
	}
	if (kind === 'quota' && !period) {
		return { ok: false, error: 'Quota meters need a period (day/month)' };
	}

	await db.insert(meters).values({
		projectId,
		name: parsed.data.name,
		kind,
		scope: parsed.data.scope,
		limit: parsed.data.limit,
		periodSeconds: kind === 'rate' ? periodSeconds : null,
		period: kind === 'quota' ? period : null,
	});

	revalidatePath(`/dashboard/projects/${projectId}`);
	return { ok: true };
}
