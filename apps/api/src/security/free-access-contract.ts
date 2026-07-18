export const EXTERNAL_SCOPES = ["matches:read", "events:read", "scenarios:read", "historical:read", "verification:read", "stream:read"] as const;
export type ExternalScope = (typeof EXTERNAL_SCOPES)[number];
export const TOKEN_TTL_SECONDS = 600;
export const MAX_APPLICATIONS = 5;
export const MAX_CREDENTIALS = 2;
export const MAX_SESSIONS = 5;
export const GENERIC_ERROR = { error: "request_rejected", message: "The request could not be completed." } as const;
export type PublicSession = { walletAddress: string; authenticated: true; expiresAt: string };
export type SafeApplication = { id: string; name: string; scopes: ExternalScope[]; disabled: boolean; createdAt: string };

const PUBLIC_ROUTES: Array<[string, ExternalScope]> = [
  ["/api/matches", "matches:read"],
  ["/api/public/status", "matches:read"],
  ["/api/public/matches", "matches:read"],
  ["/api/public/v1/matches", "matches:read"],
  ["/api/public/v1/competition/replay", "historical:read"]
];

export function scopeForRoute(method: string, path: string): ExternalScope | undefined {
  if (method !== "GET") return undefined;
  const clean = path.split("?")[0].replace(/\/$/, "") || "/";
  for (const [prefix, scope] of PUBLIC_ROUTES) {
    if (clean === prefix || clean.startsWith(`${prefix}/`)) return scope;
  }
  return undefined;
}
export function isPublicScope(value: unknown): value is ExternalScope {
  return typeof value === "string" && (EXTERNAL_SCOPES as readonly string[]).includes(value);
}
export function requestedScopes(value: unknown): ExternalScope[] | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return [];
  const values = value.split(" ").filter(Boolean);
  return values.every(isPublicScope) ? values as ExternalScope[] : [];
}
export function safeError(status = 400) { return { status, body: GENERIC_ERROR }; }
