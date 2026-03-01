/**
 * Validates that a required environment variable is set.
 * Call this at the top of any Action that uses external APIs.
 * Throws on startup rather than failing silently at runtime.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}
