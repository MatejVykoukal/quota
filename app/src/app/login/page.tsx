import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await isAuthenticated()) {
    redirect("/dashboard");
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="focus-ring font-mono text-sm font-semibold tracking-tight"
        >
          quota
        </Link>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-muted">
          Demo access — use the credentials below.
        </p>

        <LoginForm />

        <p className="mt-6 rounded-md border border-border bg-surface p-3 font-mono text-xs text-muted">
          demo@quota.dev / demo1234
        </p>
      </div>
    </div>
  );
}
