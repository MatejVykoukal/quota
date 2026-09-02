'use client';

import { useRef, useState } from 'react';
import { createProject } from './actions';

export function NewProjectButton() {
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const formRef = useRef<HTMLFormElement>(null);

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setError(null);
		setPending(true);
		const res = await createProject(new FormData(e.currentTarget));
		// On success the action redirects; here we only handle validation errors.
		if (res && !res.ok) {
			setError(res.error);
			setPending(false);
		}
	}

	if (!open) {
		return (
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="focus-ring shrink-0 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
			>
				New project
			</button>
		);
	}

	return (
		<form
			ref={formRef}
			onSubmit={onSubmit}
			className="w-full rounded-lg border border-border bg-surface p-4 sm:w-96"
		>
			<div>
				<label htmlFor="project-name" className="block text-sm font-medium leading-none">
					Name
				</label>
				<input
					id="project-name"
					name="name"
					required
					maxLength={100}
					autoFocus
					className="focus-ring mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
					placeholder="e.g. Public API"
				/>
			</div>
			<div className="mt-3">
				<label htmlFor="project-description" className="block text-sm font-medium leading-none">
					Description <span className="text-muted">(optional)</span>
				</label>
				<input
					id="project-description"
					name="description"
					maxLength={300}
					className="focus-ring mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
					placeholder="What is this API for?"
				/>
			</div>
			{error && (
				<p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
					{error}
				</p>
			)}
			<div className="mt-4 flex justify-end gap-2">
				<button
					type="button"
					onClick={() => setOpen(false)}
					className="focus-ring rounded-md px-3 py-2 text-sm text-muted transition-colors hover:text-foreground"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={pending}
					className="focus-ring rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{pending ? 'Creating…' : 'Create'}
				</button>
			</div>
		</form>
	);
}
