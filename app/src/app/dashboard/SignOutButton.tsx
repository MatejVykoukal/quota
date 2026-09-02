"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();

  const signOut = useCallback(async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }, [router]);

  return (
    <button
      type="button"
      onClick={signOut}
      className="focus-ring rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:border-foreground/30"
    >
      Sign out
    </button>
  );
}
