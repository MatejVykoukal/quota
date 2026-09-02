import { NextRequest, NextResponse } from "next/server";
import { DEMO_EMAIL, verifyDemoPassword, setSessionCookie, clearSessionCookie, isAuthenticated } from "@/lib/auth";
import { verifyPassword } from "@/lib/auth";
import { checkAndRecordLoginAttempt, clearLoginAttempts } from "@/lib/rate-limit";

export async function GET() {
  return NextResponse.json({ authenticated: await isAuthenticated() });
}

export async function POST(req: NextRequest) {
  // The app is only ever reached through a trusted reverse proxy (Caddy in
  // docker-compose, the platform edge on Railway), which overwrites
  // X-Forwarded-For with the real client IP. Never trust this header when
  // running the app directly without a proxy in front.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (!(await checkAndRecordLoginAttempt(ip))) {
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  }

  const { email, password } = await req.json().catch(() => ({}));
  if (
    email !== DEMO_EMAIL ||
    typeof password !== "string" ||
    !verifyDemoPassword(password)
  ) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  await clearLoginAttempts(ip);
  await setSessionCookie();
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
