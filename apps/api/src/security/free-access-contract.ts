export const EXTERNAL_SCOPES = ["matches:read", "events:read", "scenarios:read", "historical:read", "verification:read", "stream:read"] as const;
export type ExternalScope = (typeof EXTERNAL_SCOPES)[number];
export const TOKEN_TTL_SECONDS = 600;
export const MAX_APPLICATIONS = 5;
export const MAX_CREDENTIALS = 2;
export const GENERIC_ERROR = { error: "request_rejected", message: "The request could not be completed." } as const;
export type PublicSession = { walletAddress: string; authenticated: true; expiresAt: string };
export type SafeApplication = { id: string; name: string; scopes: ExternalScope[]; disabled: boolean; createdAt: string };
export function scopeForRoute(method: string, path: string): ExternalScope | undefined {
  if (method !== "GET") return undefined;
  if (path.startsWith("/api/matches")) return "matches:read";
  if (path.startsWith("/api/events")) return "events:read";
  if (path.startsWith("/api/scenarios")) return "scenarios:read";
  if (path.startsWith("/api/historical")) return "historical:read";
  if (path.startsWith("/api/verification")) return "verification:read";
  if (path.startsWith("/api/stream")) return "stream:read";
  return undefined;
}
export function isPublicScope(value: string): value is ExternalScope { return (EXTERNAL_SCOPES as readonly string[]).includes(value); }
export function safeError(status = 400) { return { status, body: GENERIC_ERROR }; }
