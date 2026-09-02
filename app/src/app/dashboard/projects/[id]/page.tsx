import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, count, desc, eq, gte, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { apiKeys, meters, projects, requests, usage } from '@/db/schema';
import { currentWindowStart } from '@/lib/enforce';
import { KeysPanel, type KeyRow } from './KeysPanel';
import { RequestsList, type RequestRow } from './RequestsList';

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

function SegmentedBar({
	total,
	limit,
	segments,
}: {
	total: number;
	limit: number;
	segments: { label: string; name: string; used: number }[];
}) {
	const opacities = [1, 0.7, 0.5, 0.35, 0.25];
	return (
		<>
			{/* The visible bar is 6px tall, but each segment is a taller hover
			    zone (py-3) — easy to target without changing the layout. No
			    overflow-hidden anywhere: it would clip the tooltips. */}
			<div
				className="relative -my-3 py-3"
				role="progressbar"
				aria-valuenow={total}
				aria-valuemin={0}
				aria-valuemax={limit}
			>
				<div
					aria-hidden="true"
					className="h-1.5 w-full rounded-full bg-border"
				/>
				<div
					aria-hidden="true"
					className="absolute inset-0 flex items-center"
				>
					{segments.map((seg, i) => (
						<div
							key={seg.label}
							className="group relative flex h-7 items-center"
							style={{ width: `${(seg.used / limit) * 100}%` }}
						>
							<div
								className={`h-1.5 w-full bg-accent ${i === 0 ? 'rounded-l-full' : ''} ${
									i === segments.length - 1 ? 'rounded-r-full' : ''
								}`}
								style={{ opacity: opacities[i % opacities.length] }}
							/>
							<div
								role="tooltip"
								className="pointer-events-none absolute left-1/2 top-full z-50 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs shadow-lg group-hover:block"
							>
								<span className="font-sans font-medium text-foreground">
									{seg.name}
								</span>
								<span className="ml-2 text-muted">
									{seg.label} · {seg.used}
								</span>
							</div>
						</div>
					))}
				</div>
			</div>
			<ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
				{segments.map((seg, i) => (
					<li
						key={seg.label}
						className="flex items-center gap-1.5 font-mono text-xs text-muted"
					>
						<span
							className="inline-block size-2 rounded-full bg-accent"
							style={{ opacity: opacities[i % opacities.length] }}
						/>
						{seg.label} · {seg.used}
					</li>
				))}
			</ul>
		</>
	);
}

export default async function ProjectPage(
	props: PageProps<'/dashboard/projects/[id]'>,
) {
	const { id } = await props.params;
	if (!routeIdSchema.safeParse(id).success) notFound();

	const [project] = await db.select().from(projects).where(eq(projects.id, id));
	if (!project) notFound();

	const [projectMeters, activeKeys, allKeys, recentRequestsRaw, totalRow] = await Promise.all([
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
		db
			.select()
			.from(apiKeys)
			.where(eq(apiKeys.projectId, id))
			.orderBy(apiKeys.createdAt),
		db
			.select()
			.from(requests)
			.where(eq(requests.projectId, id))
			.orderBy(desc(requests.createdAt))
			.limit(50),
		db.select({ total: count() }).from(requests).where(eq(requests.projectId, id)),
	]);

	// Current window usage per (meter, scope). Key-scope meters show one bar
	// per active key; project-scope meters show a single shared bar.
	const keyIds = activeKeys.map((k) => k.id);
	const usageRows =
		projectMeters.length > 0
			? await db
					.select({
						meterId: usage.meterId,
						apiKeyId: usage.apiKeyId,
						projectId: usage.projectId,
						count: usage.count,
					})
					.from(usage)
					.where(
						and(
							inArray(
								usage.meterId,
								projectMeters.map((m) => m.id),
							),
							inArray(
								usage.windowStart,
								projectMeters.map((m) => currentWindowStart(m)),
							),
						),
					)
			: [];

	const usageMap = new Map(
		usageRows.map(
			(r) => [`${r.meterId}:${r.apiKeyId ?? r.projectId}`, Number(r.count)] as const,
		),
	);

	// Project-scope meters aggregate usage into a single counter, so the
	// per-key split comes from the request log instead: consumed requests
	// (status 200) of each meter's current window, grouped by key.
	const projectScopeMeters = projectMeters.filter((m) => m.scope === 'project');
	const segmentsByMeter = new Map<string, { keyId: string; used: number }[]>();
	for (const meter of projectScopeMeters) {
		if (keyIds.length === 0) break;
		const rows = await db
			.select({ apiKeyId: requests.apiKeyId, used: count() })
			.from(requests)
			.where(
				and(
					eq(requests.projectId, id),
					eq(requests.status, 200),
					gte(requests.createdAt, currentWindowStart(meter)),
					inArray(requests.apiKeyId, keyIds),
				),
			)
			.groupBy(requests.apiKeyId);
		segmentsByMeter.set(
			meter.id,
			rows.map((r) => ({ keyId: r.apiKeyId!, used: Number(r.used) })),
		);
	}

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
				Each bar is one active key (key-scope limits) or the whole project
				(project-scope limits) — exactly as the gateway enforces them.
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
									{meter.scope === 'project' ? 'project' : 'key'} ·{' '}
									{windowLabel(meter)}
								</span>
							</div>
							<ul className="mt-3 space-y-4">
								{(meter.scope === 'project'
									? [{ id: project.id, label: 'whole project' }]
									: activeKeys.map((k) => ({
											id: k.id,
											label: k.prefix,
										}))
								).map((bar) => {
									const used =
										usageMap.get(`${meter.id}:${bar.id}`) ?? 0;
									const segments = segmentsByMeter
										.get(meter.id)
										?.map((seg) => {
											const key = activeKeys.find(
												(k) => k.id === seg.keyId,
											);
											return {
												label: key?.prefix ?? 'unknown',
												name: key?.name ?? 'unknown key',
												used: seg.used,
											};
										});
									return (
										<li key={bar.id}>
											<div className="flex items-baseline justify-between gap-4 text-sm">
												<span className="font-mono text-xs text-muted">
													{bar.label}
												</span>
												<span className="tabular-nums">
													{used}
													<span className="text-muted"> / {meter.limit}</span>
												</span>
											</div>
											{meter.scope === 'project' && segments && segments.length > 0 ? (
												<SegmentedBar
													total={used}
													limit={meter.limit}
													segments={segments}
												/>
											) : (
												<div className="mt-1.5">
													<Bar used={used} limit={meter.limit} />
												</div>
											)}
										</li>
									);
								})}
							</ul>
						</section>
					))}
				</div>
			)}

			<KeysPanel
				projectId={id}
				keys={allKeys.map(
					(k): KeyRow => ({
						id: k.id,
						name: k.name,
						prefix: k.keyPrefix,
						revoked: k.revokedAt !== null,
						createdAt: k.createdAt.toISOString().slice(0, 10),
					}),
				)}
			/>

			<RequestsList
				projectId={id}
				total={Number(totalRow[0]?.total ?? 0)}
				initialRequests={recentRequestsRaw.map(
					(r): RequestRow => ({
						id: r.id,
						createdAt: r.createdAt.toISOString(),
						method: r.method,
						status: r.status,
						path: r.path,
						latencyMs: r.latencyMs,
					}),
				)}
			/>
		</div>
	);
}
