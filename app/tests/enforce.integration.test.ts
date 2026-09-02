import { afterAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { generateApiKey } from "@/lib/auth";
import { enforce } from "@/lib/enforce";

// Integration test against the dev Postgres (docker-compose). Creates its
// own project and cleans up afterwards.

const cleanupIds: string[] = [];

afterAll(async () => {
	for (const id of cleanupIds) {
		await db.delete(schema.projects).where(eq(schema.projects.id, id));
	}
});

async function setupProject(meters: {
	rateLimit: number;
	quotaLimit: number;
}) {
	const [project] = await db
		.insert(schema.projects)
		.values({ name: `test-${Date.now()}-${Math.random()}` })
		.returning();
	cleanupIds.push(project.id);

	const { keyHash } = generateApiKey();
	const [key] = await db
		.insert(schema.apiKeys)
		.values({ projectId: project.id, name: "test", keyHash, keyPrefix: "x" })
		.returning();

	await db.insert(schema.meters).values([
		{
			projectId: project.id,
			name: "rate",
			kind: "rate",
			scope: "key",
			limit: meters.rateLimit,
			periodSeconds: 60,
		},
		{
			projectId: project.id,
			name: "quota",
			kind: "quota",
			scope: "project",
			limit: meters.quotaLimit,
			period: "day",
		},
	]);

	return { project, key };
}

describe("enforce (integration)", () => {
	it("allows requests within limits and counts per scope", async () => {
		const { key } = await setupProject({ rateLimit: 3, quotaLimit: 3 });

		for (let i = 1; i <= 3; i++) {
			const { allowed, results } = await enforce(key.id);
			expect(allowed).toBe(true);
			expect(results.find((r) => r.meterName === "rate")?.used).toBe(i);
			// project-scope quota counts all keys of the project — the single
			// key consumed i requests so far
			expect(results.find((r) => r.meterName === "quota")?.used).toBe(i);
		}
	});

	it("rejects when any meter is over its limit and rolls back the rest", async () => {
		const { project, key } = await setupProject({ rateLimit: 3, quotaLimit: 3 });

		const projectMeters = await db
			.select()
			.from(schema.meters)
			.where(eq(schema.meters.projectId, project.id));

		// exhaust both meters
		for (let i = 0; i < 3; i++) {
			await enforce(key.id);
		}

		const { allowed, results } = await enforce(key.id);
		expect(allowed).toBe(false);
		expect(results.find((r) => r.meterName === "rate")?.used).toBe(3);
		expect(results.find((r) => r.meterName === "quota")?.used).toBe(3);

		// the rejected request must not have consumed anything
		const usageRows = await db
			.select({ count: schema.usage.count })
			.from(schema.usage)
			.where(
				inArray(
					schema.usage.meterId,
					projectMeters.map((m) => m.id),
				),
			);
		expect(usageRows.length).toBe(2);
		for (const row of usageRows) {
			expect(Number(row.count)).toBe(3);
		}
	});

	it("shares project-scope quota across keys but not rate limits", async () => {
		const { project, key: key1 } = await setupProject({
			rateLimit: 100,
			quotaLimit: 3,
		});

		// a second key for the same project
		const { keyHash: hash2 } = generateApiKey();
		const [key2] = await db
			.insert(schema.apiKeys)
			.values({
				projectId: project.id,
				name: "second",
				keyHash: hash2,
				keyPrefix: "y",
			})
			.returning();

		// key1 consumes the whole project quota
		for (let i = 0; i < 3; i++) {
			expect((await enforce(key1.id)).allowed).toBe(true);
		}

		// key2 has a fresh rate counter but is blocked by the shared quota —
		// and its rate counter must be rolled back on rejection
		const second = await enforce(key2.id);
		expect(second.allowed).toBe(false);
		expect(second.results.find((r) => r.meterName === "rate")?.used).toBe(0);
	});

	it("returns not-allowed for an unknown key", async () => {
		const { allowed } = await enforce(
			"00000000-0000-0000-0000-000000000000",
		);
		expect(allowed).toBe(false);
	});
});
