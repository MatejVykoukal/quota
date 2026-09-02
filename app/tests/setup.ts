// Test environment. The integration tests talk to the dev Postgres from
// docker-compose (postgres://quota:quota@localhost:5433/quota); they create
// their own projects/keys and clean up after themselves.
process.env.DATABASE_URL ??= "postgres://quota:quota@localhost:5433/quota";
process.env.AUTH_SECRET ??= "test-secret";

