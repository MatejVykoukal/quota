import { describe, expect, it } from "vitest";
import {
	createSessionToken,
	generateApiKey,
	hashApiKey,
	hashPassword,
	verifyPassword,
	verifySessionToken,
} from "@/lib/auth";

describe("password hashing", () => {
	it("verifies the correct password", async () => {
		const hash = hashPassword("s3cret!");
		expect(verifyPassword("s3cret!", hash)).toBe(true);
	});

	it("rejects a wrong password", () => {
		const hash = hashPassword("s3cret!");
		expect(verifyPassword("wrong", hash)).toBe(false);
	});

	it("produces a salted hash — same password, different hashes", () => {
		expect(hashPassword("same")).not.toBe(hashPassword("same"));
	});

	it("rejects malformed stored hashes", () => {
		expect(verifyPassword("x", "not-a-hash")).toBe(false);
		expect(verifyPassword("x", "")).toBe(false);
	});
});

describe("api keys", () => {
	it("generates keys whose hash round-trips", () => {
		const { key, keyHash } = generateApiKey();
		expect(key.startsWith("qk_live_")).toBe(true);
		expect(hashApiKey(key)).toBe(keyHash);
	});

	it("generates unique keys", () => {
		const a = generateApiKey();
		const b = generateApiKey();
		expect(a.key).not.toBe(b.key);
		expect(a.keyHash).not.toBe(b.keyHash);
	});
});

describe("session tokens", () => {
	it("verifies a freshly created token", () => {
		const { token } = createSessionToken();
		expect(verifySessionToken(token)).toBe(true);
	});

	it("rejects tampered tokens", () => {
		const { token } = createSessionToken();
		const [user, expiry] = token.split(".");
		expect(verifySessionToken(`${user}.${expiry}.forgedsig`)).toBe(false);
	});

	it("rejects expired tokens", () => {
		const { token } = createSessionToken();
		const [user, expiryMs, sig] = token.split(".");
		const expired = new Date(Date.now() - 1000).getTime();
		expect(verifySessionToken(`${user}.${expired}.${sig}`)).toBe(false);
		// keep expiry referenced so the destructure stays meaningful
		expect(Number(expiryMs)).toBeGreaterThan(0);
	});

	it("rejects garbage", () => {
		expect(verifySessionToken(undefined)).toBe(false);
		expect(verifySessionToken("")).toBe(false);
		expect(verifySessionToken("not-a-token")).toBe(false);
	});
});
