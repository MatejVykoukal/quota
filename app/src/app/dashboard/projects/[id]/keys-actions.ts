'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { apiKeys } from '@/db/schema';
import { generateApiKey } from '@/lib/auth';

const keyNameSchema = z
	.string()
	.trim()
	.min(1, 'Name is required')
	.max(100, 'Name must be at most 100 characters');

export interface CreateKeyResult {
	ok: boolean;
	// The plaintext key — returned exactly once, never stored or sent again.
	plainKey?: string;
	error?: string;
}

export async function createKey(
	projectId: string,
	_prev: CreateKeyResult | null,
	formData: FormData,
): Promise<CreateKeyResult> {
	const parsed = keyNameSchema.safeParse(formData.get('name'));
	if (!parsed.success) {
		return { ok: false, error: parsed.error.issues[0].message };
	}

	const { key, keyHash, keyPrefix } = generateApiKey();
	await db.insert(apiKeys).values({
		projectId,
		name: parsed.data,
		keyHash,
		keyPrefix,
	});

	revalidatePath(`/dashboard/projects/${projectId}`);
	return { ok: true, plainKey: key };
}

export async function revokeKey(projectId: string, keyId: string) {
	// Validate both ids — they arrive from the client.
	if (
		![projectId, keyId].every((id) => z.string().uuid().safeParse(id).success)
	) {
		return;
	}

	await db
		.update(apiKeys)
		.set({ revokedAt: new Date() })
		.where(
			and(
				eq(apiKeys.id, keyId),
				eq(apiKeys.projectId, projectId),
				isNull(apiKeys.revokedAt),
			),
		);

	revalidatePath(`/dashboard/projects/${projectId}`);
}

/** Temporarily pause/resume a key without revoking it. */
export async function setKeyEnabled(
	projectId: string,
	keyId: string,
	enabled: boolean,
) {
	if (
		![projectId, keyId].every((id) => z.string().uuid().safeParse(id).success)
	) {
		return;
	}

	await db
		.update(apiKeys)
		.set({ enabled })
		.where(
			and(
				eq(apiKeys.id, keyId),
				eq(apiKeys.projectId, projectId),
				isNull(apiKeys.revokedAt),
			),
		);

	revalidatePath(`/dashboard/projects/${projectId}`);
}
