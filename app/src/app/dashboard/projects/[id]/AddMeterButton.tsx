'use client';

import { useActionState, useState } from 'react';
import { addMeter, type AddMeterResult } from '../../actions';

export function AddMeterButton({ projectId }: { projectId: string }) {
	const [open, setOpen] = useState(false);
	const [kind, setKind] = useState<'rate' | 'quota'>('rate');
	const [formState, formAction, pending] = useActionState(
		(prev: AddMeterResult | null, formData: FormData) =>
			addMeter(projectId, prev, formData).then((r) => {
				if (r.ok) setOpen(false);
				return r;
			}),
		null,
	);

	if (!open) {
		return (
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="focus-ring shrink-0 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:border-foreground/30"
			>
				Add meter
			</button>
		);
	}

	return (
		<form action={formAction} className="w-full rounded-lg border border-border bg-surface p-4 sm:w-96">
			<div>
				<label htmlFor="meter-name" className="block text-sm font-medium leading-none">
					Name
				</label>
				<input
					id="meter-name"
					name="name"
					required
					maxLength={100}
					autoFocus
					className="focus-ring mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
					placeholder="e.g. Burst limit"
				/>
			</div>

			<div className="mt-3 grid grid-cols-2 gap-3">
				<div>
					<label htmlFor="meter-kind" className="block text-sm font-medium leading-none">
						Kind
					</label>
					<select
						id="meter-kind"
						name="kind"
						value={kind}
						onChange={(e) => setKind(e.target.value as 'rate' | 'quota')}
						className="focus-ring mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
					>
						<option value="rate">rate (requests / period)</option>
						<option value="quota">quota (calendar window)</option>
					</select>
				</div>
				<div>
					<label htmlFor="meter-scope" className="block text-sm font-medium leading-none">
						Scope
					</label>
					<select
						id="meter-scope"
						name="scope"
						defaultValue="key"
						className="focus-ring mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
					>
						<option value="key">per key</option>
						<option value="project">whole project</option>
					</select>
				</div>
			</div>

			<div className="mt-3 grid grid-cols-2 gap-3">
				<div>
					<label htmlFor="meter-limit" className="block text-sm font-medium leading-none">
						Limit
					</label>
					<input
						id="meter-limit"
						name="limit"
						type="number"
						min={1}
						max={1_000_000}
						required
						className="focus-ring mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
						placeholder={kind === 'rate' ? '100' : '1000'}
					/>
				</div>
				{kind === 'rate' ? (
					<div>
						<label htmlFor="meter-period-seconds" className="block text-sm font-medium leading-none">
							Period (seconds)
						</label>
						<select
							id="meter-period-seconds"
							name="periodSeconds"
							defaultValue="60"
							className="focus-ring mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
						>
							<option value="10">10 s</option>
							<option value="30">30 s</option>
							<option value="60">60 s</option>
							<option value="300">5 min</option>
							<option value="3600">1 h</option>
						</select>
					</div>
				) : (
					<div>
						<label htmlFor="meter-period" className="block text-sm font-medium leading-none">
							Window
						</label>
						<select
							id="meter-period"
							name="period"
							defaultValue="day"
							className="focus-ring mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
						>
							<option value="day">per day</option>
							<option value="month">per month</option>
						</select>
					</div>
				)}
			</div>

			{formState && !formState.ok && (
				<p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
					{formState.error}
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
					{pending ? 'Adding…' : 'Add meter'}
				</button>
			</div>
		</form>
	);
}
