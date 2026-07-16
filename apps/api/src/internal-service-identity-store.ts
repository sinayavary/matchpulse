import type { PrismaClient } from "@prisma/client";
import {
  authorizeServiceCredential,
  getServiceCredentialPrefix,
  type InternalScope,
  type ServiceAuthDecision
} from "./internal-service-identity.js";

export function requiredScopeForInternalRoute(pathname: string): InternalScope {
  if (pathname.includes("/audit/")) return "runtime:audit";
  if (pathname.includes("/ingest")) return "ingestion:write";
  if (pathname.includes("/provider") || pathname.includes("/txline/live")) return "provider:operate";
  return "internal:read";
}

export function createPrismaServiceAuthResolver(input: {
  db: PrismaClient;
  audit?: Pick<PrismaClient, "internalAuthAuditEvent">;
}) {
  return async function resolveServiceAuth(token: string | null, pathname: string): Promise<ServiceAuthDecision> {
    const prefix = typeof token === "string" ? getServiceCredentialPrefix(token) : null;
    const credential = prefix === null
      ? null
      : await input.db.internalServiceCredential.findFirst({
          where: { prefix },
          include: { scopes: true, serviceIdentity: true }
        });
    const decision = authorizeServiceCredential({
      token,
      credential,
      requiredScope: requiredScopeForInternalRoute(pathname)
    });

    if (decision.ok) {
      const now = new Date();
      await input.db.internalServiceCredential.update({
        where: { id: decision.credentialId },
        data: { lastUsedAt: now }
      });
      await input.db.internalServiceIdentity.update({
        where: { id: decision.serviceIdentityId },
        data: { lastUsedAt: now }
      });
      const audit = input.audit ?? input.db;
      if (audit !== undefined) {
        await audit.internalAuthAuditEvent.create({
          data: {
            eventType: "authentication_success",
            serviceIdentityId: decision.serviceIdentityId,
            credentialId: decision.credentialId,
            scope: requiredScopeForInternalRoute(pathname),
            method: null,
            route: pathname,
            success: true,
            reason: null,
            occurredAt: now
          }
        });
      }
    }
    return decision;
  };
}
