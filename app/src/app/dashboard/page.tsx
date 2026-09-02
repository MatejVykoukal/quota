import Link from "next/link";
import { count, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, projects, requests } from "@/db/schema";
import { startOfUtcDay } from "@/lib/dates";
import { NewProjectButton } from "./NewProjectButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [allProjects, keysByProject, requestsTodayByProject] =
    await Promise.all([
      db.select().from(projects).orderBy(projects.createdAt),
      db
        .select({ projectId: apiKeys.projectId, active: count() })
        .from(apiKeys)
        .where(sql`${apiKeys.revokedAt} IS NULL AND ${apiKeys.enabled}`)
        .groupBy(apiKeys.projectId),
      db
        .select({
          projectId: requests.projectId,
          total: count(),
          limited: sql<number>`count(*) filter (where ${requests.status} = 429)`,
        })
        .from(requests)
        .where(gte(requests.createdAt, startOfUtcDay()))
        .groupBy(requests.projectId),
    ]);

  const keysMap = new Map(keysByProject.map((r) => [r.projectId, r.active]));
  const reqMap = new Map(
    requestsTodayByProject.map((r) => [r.projectId, r]),
  );

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted">
            Usage across your API projects — today (UTC).
          </p>
        </div>
        <NewProjectButton />
      </div>

      {allProjects.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-sm font-medium">No projects yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Create your first project to issue API keys and define usage
            limits.
          </p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {allProjects.map((p) => {
            const stats = reqMap.get(p.id);
            return (
              <li key={p.id}>
                <Link
                  href={`/dashboard/projects/${p.id}`}
                  className="focus-ring block rounded-lg border border-border bg-surface p-5 transition-colors hover:border-foreground/25"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <h2 className="font-semibold tracking-tight">{p.name}</h2>
                    <span className="font-mono text-xs text-muted">
                      {keysMap.get(p.id) ?? 0} active keys
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-sm text-muted">
                    {p.description ?? "—"}
                  </p>
                  <dl className="mt-5 grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-xs text-muted">Requests today</dt>
                      <dd className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">
                        {stats?.total ?? 0}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Limited (429)</dt>
                      <dd className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">
                        {Number(stats?.limited ?? 0)}
                      </dd>
                    </div>
                  </dl>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
