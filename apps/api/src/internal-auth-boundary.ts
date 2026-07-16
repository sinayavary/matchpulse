import type { FastifyInstance } from "fastify";
import { verifyInternalRouteAuth } from "./internal-auth.js";

export const INTERNAL_ROUTE_PREFIX = "/api/internal/";

export function isInternalRoutePath(pathname: string): boolean {
  return pathname === "/api/internal" || pathname.startsWith(INTERNAL_ROUTE_PREFIX);
}

export function registerInternalAuthBoundary(
  app: FastifyInstance,
  options: { env?: Record<string, string | undefined> } = {}
): void {
  app.addHook("onRequest", async (request, reply) => {
    const pathname = request.url.split("?", 1)[0];
    if (!isInternalRoutePath(pathname)) return;

    const result = verifyInternalRouteAuth({
      headers: request.headers,
      env: options.env ?? process.env
    });

    if (result.ok) return;

    reply.code(result.configured ? 401 : 503);
    return reply.send({
      data: null,
      meta: {
        status: "error",
        source: "backend",
        mode: "internal",
        code: result.configured ? "internal_auth_failed" : "internal_auth_not_configured",
        message: result.configured
          ? "Internal authentication failed."
          : "Internal authentication is not configured."
      }
    });
  });
}
