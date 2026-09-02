import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { apiKeys, meters, projects, usage } from '@/db/schema';
import { currentWindowStart } from '@/lib/enforce';

export const dynamic = 'force-dynamic';

const routeIdSchema = z.string().uuid();

function windowLabel(meter: typeof meters.$inferSelect): string {
	if (meter.kind === 'rate') {
		const s = meter.periodSeconds ?? 60;
		return s >= 60 ? `per ${s / 60} min` : `per ${s} s`;
	}
	return meter.period === 'month' ? 'this month' : 'today';
}

function Bar({ used, limit }: { used: number; limit: number }) {
	const pct = Math.min(100, (used / limit) * 100);
	const tone =
		pct >= 100 ? 'bg-red-600' : pct >= 80 ? 'bg-amber-500' : 'bg-accent';

	return (
		<div
			role="progressbar"
			aria-valuenow={used}
			aria-valuemin={0}
			aria-valuemax={limit}
			className="h-1.5 w-full overflow-hidden rounded-full bg-border"
		>
			<div
				className={`h-full rounded-full ${tone}`}
				style={{ width: `${pct}%` }}
			/>
		</div>
	);
}

export default async function ProjectPage(
	props: PageProps<'/dashboard/projects/[id]'>,
) {
	const { id } = await props.params;
	if (!routeIdSchema.safeParse(id).success) notFound();

	const [project] = await db.select().from(projects).where(eq(projects.id, id));
	if (!project) notFound();

	const [projectMeters, activeKeys] = await Promise.all([
		db.select().from(meters).where(eq(meters.projectId, id)),
		db
			.select({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.keyPrefix })
			.from(apiKeys)
			.where(
				and(
					eq(apiKeys.projectId, id),
					isNull(apiKeys.revokedAt),
					eq(apiKeys.enabled, true),
				),
			),
	]);

	// Current window usage per (meter, key). Limits apply per key — that is
	// exactly what the gateway enforces — so usage is shown per key.
	const keyIds = activeKeys.map((k) => k.id);
	const usageRows =
		keyIds.length > 0
			? await db
					.select({
						meterId: usage.meterId,
						apiKeyId: usage.apiKeyId,
						count: usage.count,
					})
					.from(usage)
					.where(
						and(
							inArray(
								usage.meterId,
								projectMeters.map((m) => m.id),
							),
							inArray(usage.apiKeyId, keyIds),
							inArray(
								usage.windowStart,
								projectMeters.map((m) => currentWindowStart(m)),
							),
						),
					)
			: [];

	const usageMap = new Map(
		usageRows.map((r) => [`${r.meterId}:${r.apiKeyId}`, Number(r.count)]),
	);

	return (
		<div>
			<Link
				href="/dashboard"
				className="focus-ring text-sm text-muted underline-offset-4 transition-colors hover:text-foreground hover:underline"
			>
				← Projects
			</Link>
			<h1 className="mt-3 text-2xl font-semibold tracking-tight">
				{project.name}
			</h1>
			<p className="mt-1 text-sm text-muted">{project.description ?? '—'}</p>

			<h2 className="mt-10 text-base font-semibold tracking-tight">
				Limits &amp; current usage
			</h2>
			<p className="mt-1 text-sm text-muted">
				Limits are enforced per API key — each bar is one active key.
			</p>

			{projectMeters.length === 0 ? (
				<div className="mt-6 rounded-lg border border-dashed border-border p-10 text-center">
					<p className="text-sm font-medium">No meters defined</p>
					<p className="mx-auto mt-1 max-w-sm text-sm text-muted">
						This project has no limits — all gateway requests pass through
						unmetered.
					</p>
				</div>
			) : (
				<div className="mt-6 space-y-8">
					{projectMeters.map((meter) => (
						<section key={meter.id}>
							<div className="flex items-baseline justify-between gap-4">
								<h3 className="font-medium">{meter.name}</h3>
								<span className="font-mono text-xs text-muted">
									{meter.kind === 'rate' ? 'rate' : 'quota'} ·{' '}
									{windowLabel(meter)}
								</span>
							</div>
							<ul className="mt-3 space-y-4">
								{activeKeys.map((key) => {
									const used = usageMap.get(`${meter.id}:${key.id}`) ?? 0;
									return (
										<li key={key.id}>
											<div className="flex items-baseline justify-between gap-4 text-sm">
												<span className="font-mono text-xs text-muted">
													{key.prefix}
												</span>
												<span className="tabular-nums">
													{used}
													<span className="text-muted"> / {meter.limit}</span>
												</span>
											</div>
											<div className="mt-1.5">
												<Bar used={used} limit={meter.limit} />
											</div>
										</li>
									);
								})}
							</ul>
						</section>
					))}
				</div>
			)}
		</div>
	);
}
