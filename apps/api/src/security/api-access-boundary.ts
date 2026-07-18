import type { FastifyReply, FastifyRequest } from "fastify";
import { GENERIC_ERROR, scopeForRoute, type ExternalScope } from "./free-access-contract.js";
import { createApiClientAuth } from "./api-client-auth.js";
import { createApiRateLimiter } from "./api-rate-limit.js";
export const apiClientAuth = createApiClientAuth(); export const apiRateLimiter = createApiRateLimiter();
export function readBearer(request: FastifyRequest) { const value = request.headers.authorization; return value?.startsWith("Bearer ") ? value.slice(7).trim() : undefined; }
export function authorizeExternal(request: FastifyRequest, reply: FastifyReply, required?: ExternalScope) { const path = request.url.split("?")[0]; if (path.startsWith("/api/internal/")) { reply.code(404).send(GENERIC_ERROR); return false; } const scope = required ?? scopeForRoute(request.method, path); if (!scope) { reply.code(404).send(GENERIC_ERROR); return false; } const token = readBearer(request); const auth = token ? apiClientAuth.authenticate(token) : undefined; if (!auth || !auth.scopes.includes(scope)) { reply.code(401).send(GENERIC_ERROR); return false; } const key = `${request.ip}:${auth.applicationId}`; if (!apiRateLimiter.begin(key)) { reply.code(429).header("retry-after", "60").send(GENERIC_ERROR); return false; } request.raw.once("close", () => apiRateLimiter.end(key)); return true; }
