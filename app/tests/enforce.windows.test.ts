import { describe, expect, it } from "vitest";
import { currentWindowStart } from "@/lib/enforce";
import type { Meter } from "@/db/schema";

function meter(partial: Partial<Meter>): Meter {
	return {
		id: "00000000-0000-0000-0000-000000000000",
		projectId: "00000000-0000-0000-0000-000000000000",
		name: "test",
		kind: "rate",
		scope: "key",
		limit: 100,
		periodSeconds: 60,
		period: null,
		createdAt: new Date(),
		...partial,
	};
}

describe("currentWindowStart", () => {
	it("buckets rate meters into fixed periodSeconds slots", () => {
		const m = meter({ kind: "rate", periodSeconds: 60 });
		// 12:34:56 falls into the 12:34:00 slot
		const now = new Date("2026-09-02T12:34:56.789Z");
		expect(currentWindowStart(m, now).toISOString()).toBe(
			"2026-09-02T12:34:00.000Z",
		);
	});

	it("uses the configured period length", () => {
		const m = meter({ kind: "rate", periodSeconds: 10 });
		const now = new Date("2026-09-02T12:34:17.000Z");
		expect(currentWindowStart(m, now).toISOString()).toBe(
			"2026-09-02T12:34:10.000Z",
		);
	});

	it("defaults to 60s slots when periodSeconds is missing", () => {
		const m = meter({ kind: "rate", periodSeconds: null });
		const now = new Date("2026-09-02T12:34:17.000Z");
		expect(currentWindowStart(m, now).toISOString()).toBe(
			"2026-09-02T12:34:00.000Z",
		);
	});

	it("anchors quota meters at the start of the UTC day", () => {
		const m = meter({ kind: "quota", period: "day" });
		const now = new Date("2026-09-02T23:59:59.000Z");
		expect(currentWindowStart(m, now).toISOString()).toBe(
			"2026-09-02T00:00:00.000Z",
		);
	});

	it("anchors monthly quota meters at the first of the UTC month", () => {
		const m = meter({ kind: "quota", period: "month" });
		const now = new Date("2026-09-02T12:00:00.000Z");
		expect(currentWindowStart(m, now).toISOString()).toBe(
			"2026-09-01T00:00:00.000Z",
		);
	});
});
