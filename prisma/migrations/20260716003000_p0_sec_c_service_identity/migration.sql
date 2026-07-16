-- P0-SEC-C: additive service identity, credential lifecycle, scopes, and auth audit foundation.
-- No existing table, column, or audit history is removed or rewritten.

CREATE TYPE "InternalServiceIdentityStatus" AS ENUM ('ENABLED', 'DISABLED');

CREATE TABLE "internal_service_identities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "InternalServiceIdentityStatus" NOT NULL DEFAULT 'ENABLED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "last_used_at" TIMESTAMPTZ(3),
    CONSTRAINT "internal_service_identities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "internal_service_credentials" (
    "id" TEXT NOT NULL,
    "service_identity_id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "credential_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "last_used_at" TIMESTAMPTZ(3),
    CONSTRAINT "internal_service_credentials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "internal_service_credential_scopes" (
    "credential_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    CONSTRAINT "internal_service_credential_scopes_pkey" PRIMARY KEY ("credential_id", "scope")
);

CREATE TABLE "internal_auth_audit_events" (
    "id" TEXT NOT NULL,
    "service_identity_id" TEXT,
    "credential_id" TEXT,
    "event_type" TEXT NOT NULL,
    "scope" TEXT,
    "method" TEXT,
    "route" TEXT,
    "success" BOOLEAN NOT NULL,
    "reason" TEXT,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "internal_auth_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "internal_service_identities_name_key" ON "internal_service_identities"("name");
CREATE INDEX "internal_service_identities_status_idx" ON "internal_service_identities"("status");
CREATE UNIQUE INDEX "internal_service_credentials_credential_hash_key" ON "internal_service_credentials"("credential_hash");
CREATE INDEX "internal_service_credentials_service_identity_id_revoked_at_expires_at_idx" ON "internal_service_credentials"("service_identity_id", "revoked_at", "expires_at");
CREATE INDEX "internal_service_credentials_prefix_idx" ON "internal_service_credentials"("prefix");
CREATE INDEX "internal_service_credential_scopes_scope_idx" ON "internal_service_credential_scopes"("scope");
CREATE INDEX "internal_auth_audit_events_occurred_at_idx" ON "internal_auth_audit_events"("occurred_at");
CREATE INDEX "internal_auth_audit_events_event_type_occurred_at_idx" ON "internal_auth_audit_events"("event_type", "occurred_at");
CREATE INDEX "internal_auth_audit_events_service_identity_id_occurred_at_idx" ON "internal_auth_audit_events"("service_identity_id", "occurred_at");
CREATE INDEX "internal_auth_audit_events_credential_id_occurred_at_idx" ON "internal_auth_audit_events"("credential_id", "occurred_at");

ALTER TABLE "internal_service_credentials" ADD CONSTRAINT "internal_service_credentials_service_identity_id_fkey" FOREIGN KEY ("service_identity_id") REFERENCES "internal_service_identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "internal_service_credential_scopes" ADD CONSTRAINT "internal_service_credential_scopes_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "internal_service_credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "internal_auth_audit_events" ADD CONSTRAINT "internal_auth_audit_events_service_identity_id_fkey" FOREIGN KEY ("service_identity_id") REFERENCES "internal_service_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "internal_auth_audit_events" ADD CONSTRAINT "internal_auth_audit_events_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "internal_service_credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;
