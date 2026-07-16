import type { FastifyInstance } from "fastify";
import { extractInternalTokenFromHeaders, verifyInternalRouteAuth } from "./internal-auth.js";
import type { ServiceAuthDecision } from "./internal-service-identity.js";

export const INTERNAL_ROUTE_PREFIX = "/api/internal/";

export function isInternalRoutePath(pathname: string): boolean {
  return pathname === "/api/internal" || pathname.startsWith(INTERNAL_ROUTE_PREFIX);
}

export function registerInternalAuthBoundary(
  app: FastifyInstance,
  options: {
    env?: Record<string, string | undefined>;
    serviceAuth?: (token: string | null, pathname: string) => Promise<ServiceAuthDecision>;
  } = {}
): void {
  app.addHook("onRequest", async (request, reply) => {
    const pathname = request.url.split("?", 1)[0];
    if (!isInternalRoutePath(pathname)) return;

    const extracted = extractInternalTokenFromHeaders(request.headers);
    const result = options.serviceAuth === undefined
      ? verifyInternalRouteAuth({ headers: request.headers, env: options.env ?? process.env })
      : await options.serviceAuth(extracted.token, pathname);

    if (result.ok) return;

    const configured = "configured" in result ? result.configured : true;
    const status = result.reason === "scope_denied" ? 403 : configured ? 401 : 503;
    reply.code(status);
    return reply.send({
      data: null,
      meta: {
        status: "error",
        source: "backend",
        mode: "internal",
        code: result.reason === "scope_denied"
          ? "internal_scope_denied"
          : configured ? "internal_auth_failed" : "internal_auth_not_configured",
        message: result.reason === "scope_denied"
          ? "The credential does not have the required internal scope."
          : configured
          ? "Internal authentication failed."
          : "Internal authentication is not configured."
      }
    });
  });
}
