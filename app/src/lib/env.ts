/**
 * Fail-fast environment validation.
 * Import this module early (db, auth) so a missing variable crashes
 * with a clear message instead of a cryptic error later at runtime.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `See .env.example for the expected variables.`,
    );
  }
  return value;
}

export const env = {
  get databaseUrl() {
    return requireEnv("DATABASE_URL");
  },
  get authSecret() {
    return requireEnv("AUTH_SECRET");
  },
} as const;
