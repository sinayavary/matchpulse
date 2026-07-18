import type { FastifyReply, FastifyRequest } from "fastify";
import { GENERIC_ERROR, scopeForRoute, type ExternalScope } from "./free-access-contract.js";
import { createApiClientAuth } from "./api-client-auth.js";
import type { ApiClientAuth } from "./api-client-auth.js";
import { createApiRateLimiter } from "./api-rate-limit.js";
export const apiClientAuth = createApiClientAuth(); export const apiRateLimiter = createApiRateLimiter();
export type AccessQuota = { consume(applicationId: string): Promise<boolean> };
export function readBearer(request: FastifyRequest) { const value = request.headers.authorization; return value?.startsWith("Bearer ") ? value.slice(7).trim() : undefined; }
export async function authorizeExternal(request: FastifyRequest, reply: FastifyReply, required?: ExternalScope, auth: ApiClientAuth = apiClientAuth, quota?: AccessQuota): Promise<boolean> { const path = request.url.split("?")[0]; if (path.startsWith("/api/internal/")) { reply.code(404).send(GENERIC_ERROR); return false; } const scope = required ?? scopeForRoute(request.method, path); if (!scope) { reply.code(404).send(GENERIC_ERROR); return false; } const token = readBearer(request); const authenticated = token ? await auth.authenticate(token) : undefined; if (!authenticated || !authenticated.scopes.includes(scope)) { reply.code(401).send(GENERIC_ERROR); return false; } if (quota && !(await quota.consume(authenticated.applicationId))) { reply.code(429).header("retry-after", "86400").send(GENERIC_ERROR); return false; } const key = `${request.ip}:${authenticated.applicationId}`; if (!apiRateLimiter.begin(key)) { reply.code(429).header("retry-after", "60").send(GENERIC_ERROR); return false; } request.raw.once("close", () => apiRateLimiter.end(key)); return true; }
