'use client';

import { useActionState, useState } from 'react';
import {
	createKey,
	revokeKey,
	type CreateKeyResult,
} from './keys-actions';

export interface KeyRow {
	id: string;
	name: string;
	prefix: string;
	revoked: boolean;
	createdAt: string;
}

export function KeysPanel({
	projectId,
	keys,
}: {
	projectId: string;
	keys: KeyRow[];
}) {
	const [createdKey, setCreatedKey] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [formState, formAction, formPending] = useActionState(
		(prev: CreateKeyResult | null, formData: FormData) =>
			createKey(projectId, prev, formData).then((r) => {
				if (r.ok && r.plainKey) {
					setCreatedKey(r.plainKey);
					setCopied(false);
					navigator.clipboard.writeText(r.plainKey);
				}
				return r;
			}),
		null,
	);

	function copyKey() {
		if (!createdKey) return;
		navigator.clipboard.writeText(createdKey);
		setCopied(true);
	}

	return (
		<section className="mt-12">
			<div className="flex items-baseline justify-between">
				<h2 className="text-base font-semibold tracking-tight">API keys</h2>
				<span className="font-mono text-xs text-muted">
					{keys.filter((k) => !k.revoked).length} active
				</span>
			</div>

			{createdKey && (
				<div
					role="status"
					aria-live="polite"
					className="fixed top-4 right-4 left-4 z-50 rounded-lg border border-accent/40 bg-surface p-4 shadow-lg sm:left-auto sm:w-md"
				>
					<div className="flex items-start justify-between gap-3">
						<p className="text-sm font-medium">
							{copied
								? 'Key created and copied to clipboard.'
								: 'Key created.'}
						</p>
						<button
							type="button"
							onClick={() => setCreatedKey(null)}
							aria-label="Dismiss notification"
							className="focus-ring -mt-1 -mr-1 shrink-0 rounded-md p-1 text-muted transition-colors hover:text-foreground"
						>
							<svg
								aria-hidden="true"
								viewBox="0 0 16 16"
								fill="currentColor"
								className="size-4"
							>
								<path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
							</svg>
						</button>
					</div>
					<p className="mt-1 text-xs text-muted">
						This is the only time the full key is shown. Only its hash is
						stored.
					</p>
					<div className="mt-3 flex items-center gap-2">
						<code className="flex-1 overflow-x-auto rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs">
							{createdKey}
						</code>
						<button
							type="button"
							onClick={copyKey}
							className="focus-ring shrink-0 rounded-md border border-border px-3 py-2 text-xs font-medium transition-colors hover:border-foreground/30"
						>
							{copied ? 'Copied' : 'Copy'}
						</button>
					</div>
				</div>
			)}

			<ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-surface">
				{keys.length === 0 && (
					<li className="p-4 text-sm text-muted">No keys yet.</li>
				)}
				{keys.map((k) => (
					<li
						key={k.id}
						className="flex flex-wrap items-center justify-between gap-3 p-4"
					>
						<div>
							<p className="text-sm font-medium">{k.name}</p>
							<p className="mt-0.5 font-mono text-xs text-muted">
								{k.prefix} · created {k.createdAt}
							</p>
						</div>
						{k.revoked ? (
							<span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
								revoked
							</span>
						) : (
							<button
								type="button"
								onClick={() => {
									if (confirm(`Revoke key "${k.name}"?`)) {
										revokeKey(projectId, k.id);
									}
								}}
								className="focus-ring rounded-md px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-600/10 dark:text-red-400"
							>
								Revoke
							</button>
						)}
					</li>
				))}
			</ul>

			<form action={formAction} className="mt-4 flex items-end gap-2">
				<div className="flex-1">
					<label
						htmlFor="key-name"
						className="block text-sm font-medium leading-none"
					>
						New key name
					</label>
					<input
						id="key-name"
						name="name"
						maxLength={100}
						required
						className="focus-ring mt-2 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
						placeholder="e.g. production-backend"
					/>
				</div>
				<button
					type="submit"
					disabled={formPending}
					className="focus-ring shrink-0 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{formPending ? 'Creating…' : 'Create key'}
				</button>
			</form>
			{formState && !formState.ok && (
				<p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
					{formState.error}
				</p>
			)}
		</section>
	);
}
