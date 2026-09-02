import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { SignOutButton } from "./SignOutButton";

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  return (
    <div className="flex-1">
      <header className="border-b border-border">
        <div className="container-page flex h-14 items-center justify-between">
          <span className="font-mono text-sm font-semibold tracking-tight">
            quota
          </span>
          <SignOutButton />
        </div>
      </header>
      <main className="container-page py-10">{children}</main>
    </div>
  );
}
