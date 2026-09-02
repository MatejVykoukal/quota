'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

type FormStatus =
	| { state: 'idle' }
	| { state: 'loading' }
	| { state: 'error'; message: string };

export function LoginForm() {
	const router = useRouter();
	const [status, setStatus] = useState<FormStatus>({ state: 'idle' });

	const onSubmit = useCallback(
		async (e: React.SubmitEvent<HTMLFormElement>) => {
			e.preventDefault();
			setStatus({ state: 'loading' });

			const data = new FormData(e.currentTarget);
			const res = await fetch('/api/auth', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: data.get('email'),
					password: data.get('password'),
				}),
			});

			if (!res.ok) {
				setStatus({
					state: 'error',
					message:
						res.status === 429
							? 'Too many attempts — try again in a few minutes.'
							: 'Invalid email or password.',
				});
				return;
			}

			router.push('/dashboard');
			router.refresh();
		},
		[router],
	);

	return (
		<form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
			<div>
				<label
					htmlFor="email"
					className="block text-sm font-medium leading-none"
				>
					Email
				</label>
				<input
					id="email"
					name="email"
					type="email"
					autoComplete="email"
					required
					defaultValue="demo@quota.dev"
					className="focus-ring mt-2 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted/60"
					placeholder="you@example.com"
				/>
			</div>

			<div>
				<label
					htmlFor="password"
					className="block text-sm font-medium leading-none"
				>
					Password
				</label>
				<input
					id="password"
					name="password"
					type="password"
					autoComplete="current-password"
					required
					defaultValue="demo1234"
					className="focus-ring mt-2 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
				/>
			</div>

			{status.state === 'error' && (
				<p
					role="alert"
					className="flex items-start gap-2 rounded-md border border-red-600/30 bg-red-600/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
				>
					<svg
						aria-hidden="true"
						viewBox="0 0 16 16"
						fill="currentColor"
						className="mt-0.5 size-4 shrink-0"
					>
						<path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM7 5a1 1 0 0 1 2 0v3a1 1 0 0 1-2 0V5Zm1 6.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
					</svg>
					{status.message}
				</p>
			)}

			<button
				type="submit"
				disabled={status.state === 'loading'}
				className="focus-ring w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{status.state === 'loading' ? 'Signing in…' : 'Sign in'}
			</button>
		</form>
	);
}
