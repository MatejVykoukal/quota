import { defineConfig } from 'drizzle-kit';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
	throw new Error(
		'Missing required environment variable: DATABASE_URL. ' +
			'See app/.env.example for the expected variables.',
	);
}

export default defineConfig({
	schema: './src/db/schema.ts',
	out: './src/db/migrations',
	dialect: 'postgresql',
	dbCredentials: { url: dbUrl },
});
