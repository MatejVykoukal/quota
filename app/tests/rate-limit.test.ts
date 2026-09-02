import { afterAll, describe, expect, it } from "vitest";
import {
	checkAndRecordLoginAttempt,
	clearLoginAttempts,
} from "@/lib/rate-limit";

const ip = `10.0.0.${Math.floor(Math.random() * 200) + 10}`; // unique per run

afterAll(async () => {
	await clearLoginAttempts(ip);
});

describe("login rate limiting (integration)", () => {
	it("allows MAX_ATTEMPTS then locks out", async () => {
		// 10 attempts pass — the limit in lib/rate-limit.ts
		for (let i = 0; i < 10; i++) {
			expect(await checkAndRecordLoginAttempt(ip)).toBe(true);
		}
		expect(await checkAndRecordLoginAttempt(ip)).toBe(false);
		expect(await checkAndRecordLoginAttempt(ip)).toBe(false);
	});

	it("clears the counter after a successful login", async () => {
		await clearLoginAttempts(ip);
		expect(await checkAndRecordLoginAttempt(ip)).toBe(true);
	});

	it("tracks IPs independently", async () => {
		const otherIp = `10.0.0.${Math.floor(Math.random() * 200) + 10}`;
		// exhaust `ip` again
		for (let i = 0; i < 11; i++) {
			await checkAndRecordLoginAttempt(ip);
		}
		expect(await checkAndRecordLoginAttempt(ip)).toBe(false);
		expect(await checkAndRecordLoginAttempt(otherIp)).toBe(true);
		await clearLoginAttempts(otherIp);
	});
});
