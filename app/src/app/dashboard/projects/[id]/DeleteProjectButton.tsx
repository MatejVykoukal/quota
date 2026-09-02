'use client';

import { useState } from 'react';
import { deleteProject } from '../../actions';

export function DeleteProjectButton({
	projectId,
	projectName,
}: {
	projectId: string;
	projectName: string;
}) {
	const [open, setOpen] = useState(false);
	const [confirmation, setConfirmation] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function onDelete() {
		setError(null);
		setPending(true);
		const res = await deleteProject(projectId, confirmation);
		// On success the action redirects away; here we only handle errors.
		if (res && !res.ok) {
			setError(res.error);
			setPending(false);
		}
	}

	if (!open) {
		return (
			<button
				type="button"
				onClick={() => {
					setOpen(true);
					setConfirmation('');
					setError(null);
				}}
				className="focus-ring text-sm font-medium text-red-600 underline-offset-4 transition-colors hover:underline dark:text-red-400"
			>
				Delete project
			</button>
		);
	}

	const matches = confirmation.trim() === projectName;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
			onClick={() => !pending && setOpen(false)}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="delete-project-title"
				className="w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-lg"
				onClick={(e) => e.stopPropagation()}
			>
				<h3 id="delete-project-title" className="font-semibold tracking-tight">
					Delete project
				</h3>
				<p className="mt-2 text-sm text-muted">
					This permanently deletes{' '}
					<span className="font-medium text-foreground">{projectName}</span>{' '}
					and everything in it — API keys, meters, usage history and the
					request log. This cannot be undone.
				</p>
				<label
					htmlFor="delete-confirmation"
					className="mt-4 block text-sm font-medium leading-none"
				>
					Type{' '}
					<span className="font-mono text-foreground">{projectName}</span> to
					confirm
				</label>
				<input
					id="delete-confirmation"
					value={confirmation}
					onChange={(e) => setConfirmation(e.target.value)}
					autoFocus
					autoComplete="off"
					className="focus-ring mt-2 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
				/>
				{error && (
					<p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
						{error}
					</p>
				)}
				<div className="mt-5 flex justify-end gap-2">
					<button
						type="button"
						onClick={() => setOpen(false)}
						disabled={pending}
						className="focus-ring rounded-md px-3 py-2 text-sm text-muted transition-colors hover:text-foreground"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={onDelete}
						disabled={!matches || pending}
						className="focus-ring rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
					>
						{pending ? 'Deleting…' : 'Delete project'}
					</button>
				</div>
			</div>
		</div>
	);
}
