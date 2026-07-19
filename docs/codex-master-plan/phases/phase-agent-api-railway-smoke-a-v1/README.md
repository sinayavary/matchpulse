# AGENT-API-RAILWAY-SMOKE-A-v1

Human-approved deadline phase for the existing Railway production API service only. It may read Railway authentication and service metadata, perform at most one API deployment when the published source revision is not already active, set only `MATCHPULSE_PUBLIC_READ_ANONYMOUS=true` when needed, and send public read-only smoke requests.

Scope is limited to the existing Railway project, existing production environment, and existing API service. No service, environment, resource, worker, or Web deployment may be created or changed. Migration, direct database access, internal API requests, source modification, and secret output are prohibited.

Limits: Railway metadata/auth requests <= 10; deployment attempts <= 1; environment-variable mutations <= 1; public HTTP GET requests <= 30; database mutations = 0; migration count = 0.

Success requires a public status response, a catalog-selected fixture with public intelligence-card and product-intelligence HTTP 200 responses, and a public-response safety scan. Completion records whether the source was already active or one permitted API deployment succeeded.
