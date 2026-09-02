'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface RequestRow {
	id: string;
	createdAt: string;
	method: string;
	status: number;
	path: string;
	latencyMs: number;
}

function statusTone(status: number): string {
	if (status === 429) return 'bg-red-600/15 text-red-600 dark:text-red-400';
	if (status >= 400)
		return 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
	return 'bg-accent/15 text-accent';
}

function Row({ r }: { r: RequestRow }) {
	return (
		<li className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
			<span className="text-muted">
				{r.createdAt.replace('T', ' ').slice(0, 19)}
			</span>
			<span className="w-12 shrink-0">{r.method}</span>
			<span
				className={`w-10 shrink-0 rounded-sm px-1 text-center font-medium ${statusTone(r.status)}`}
			>
				{r.status}
			</span>
			<span className="min-w-0 flex-1 truncate">{r.path}</span>
			<span className="ml-auto shrink-0 text-muted">{r.latencyMs} ms</span>
		</li>
	);
}

export function RequestsList({
	projectId,
	total,
	initialRequests,
}: {
	projectId: string;
	total: number;
	initialRequests: RequestRow[];
}) {
	const [rows, setRows] = useState(initialRequests);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const listRef = useRef<HTMLUListElement | null>(null);
	const sentinelRef = useRef<HTMLLIElement | null>(null);
	const [cursor, setCursor] = useState<string | null>(
		initialRequests[initialRequests.length - 1]?.createdAt ?? null,
	);
	const loadingRef = useRef(false);

	const hasMore = rows.length < total && cursor !== null;

	const loadMore = useCallback(async () => {
		if (loadingRef.current || !cursor) return;
		loadingRef.current = true;
		setLoading(true);
		setError(null);
		try {
			const res = await fetch(
				`/api/dashboard/projects/${projectId}/requests?before=${encodeURIComponent(cursor)}`,
			);
			if (!res.ok) throw new Error('Failed to load');
			const data: RequestRow[] = await res.json();
			setRows((prev) => [...prev, ...data]);
			setCursor(data[data.length - 1]?.createdAt ?? null);
		} catch {
			setError('Could not load more requests. Try again.');
		} finally {
			loadingRef.current = false;
			setLoading(false);
		}
	}, [projectId, cursor]);

	// Infinite scroll: the observer's root is the scrollable box itself, and
	// the sentinel sits inside it after the last row.
	useEffect(() => {
		const list = listRef.current;
		const sentinel = sentinelRef.current;
		if (!list || !sentinel || !hasMore) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) loadMore();
			},
			{ root: list, rootMargin: '100px' },
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [hasMore, loadMore, rows]);

	return (
		<section className="mt-12">
			<div className="flex items-baseline justify-between">
				<h2 className="text-base font-semibold tracking-tight">
					Recent requests
				</h2>
				<span className="font-mono text-xs text-muted">
					{rows.length} / {total}
				</span>
			</div>

			{rows.length === 0 ? (
				<div className="mt-4 rounded-lg border border-dashed border-border p-8 text-center">
					<p className="text-sm font-medium">No requests yet</p>
					<p className="mx-auto mt-1 max-w-sm text-sm text-muted">
						Fire one at the gateway with any project key — it will show
						here instantly.
					</p>
				</div>
			) : (
				<>
					<ul
						ref={listRef}
						className="scroll-slim mt-4 max-h-96 divide-y divide-border overflow-y-auto rounded-lg border border-border bg-surface font-mono text-xs"
					>
						{rows.map((r) => (
							<Row key={r.id} r={r} />
						))}
						<li ref={sentinelRef} aria-hidden="true" className="h-px" />
					</ul>
					{error && (
						<p
							role="alert"
							className="mt-2 text-center text-sm text-red-600 dark:text-red-400"
						>
							{error}
						</p>
					)}
					{loading && (
						<p className="mt-2 text-center text-sm text-muted">Loading…</p>
					)}
				</>
			)}
		</section>
	);
}
