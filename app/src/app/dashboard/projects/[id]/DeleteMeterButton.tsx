'use client';

import { useState } from 'react';
import { deleteMeter } from '../../actions';

export function DeleteMeterButton({
	projectId,
	meterId,
	meterName,
}: {
	projectId: string;
	meterId: string;
	meterName: string;
}) {
	const [open, setOpen] = useState(false);

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				aria-label={`Delete meter ${meterName}`}
				className="focus-ring rounded-md p-1 text-muted transition-colors hover:text-red-600 dark:hover:text-red-400"
			>
				<svg
					aria-hidden="true"
					viewBox="0 0 16 16"
					fill="currentColor"
					className="size-3.5"
				>
					<path d="M6.5 1.75A.75.75 0 0 1 7.25 1h1.5a.75.75 0 0 1 .75.75V2h3a.75.75 0 0 1 0 1.5H3.5A.75.75 0 0 1 3.5 2h3V1.75ZM4.25 4.5h7.5l-.4 9a1.5 1.5 0 0 1-1.5 1.43H6.15a1.5 1.5 0 0 1-1.5-1.43l-.4-9Z" />
				</svg>
			</button>

			{open && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
					onClick={() => setOpen(false)}
				>
					<div
						role="dialog"
						aria-modal="true"
						aria-labelledby={`delete-meter-${meterId}`}
						className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-lg"
						onClick={(e) => e.stopPropagation()}
					>
						<h3
							id={`delete-meter-${meterId}`}
							className="font-semibold tracking-tight"
						>
							Delete meter
						</h3>
						<p className="mt-2 text-sm text-muted">
							Delete{' '}
							<span className="font-medium text-foreground">{meterName}</span>{' '}
							and its usage counters? Existing request logs are kept.
						</p>
						<div className="mt-5 flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setOpen(false)}
								className="focus-ring rounded-md px-3 py-2 text-sm text-muted transition-colors hover:text-foreground"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={() => {
									deleteMeter(projectId, meterId);
									setOpen(false);
								}}
								className="focus-ring rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
							>
								Delete
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
