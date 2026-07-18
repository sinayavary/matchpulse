param()
$ErrorActionPreference = "Continue"

if (-not $env:DATABASE_URL) { throw "DATABASE_URL_REQUIRED" }
$uri = [Uri]$env:DATABASE_URL
$dbName = $uri.AbsolutePath.TrimStart('/')
if ($uri.Host -notin @("localhost", "127.0.0.1", "::1")) { throw "LOCAL_POSTGRES_16_REQUIRED" }
if ($dbName -notmatch '^matchpulse_free_access_validation_') { throw "LOCAL_POSTGRES_16_REQUIRED" }

$migrationDirs = @(Get-ChildItem "prisma/migrations" -Directory | Sort-Object Name)
$expectedMigrations = @(
  "20260705120757_init_db_foundation",
  "20260709114908_phase_0a_runtime_audit",
  "20260710140000_permanent_prediction_storage",
  "20260716003000_p0_sec_c_service_identity",
  "20260716205528_phase_10g_c_timeline",
  "20260718190000_free_access_security"
)
if ((@($migrationDirs.Name) -join '|') -ne ($expectedMigrations -join '|')) { throw "MIGRATION_SET_MISMATCH" }

$env:DATABASE_URL = $env:DATABASE_URL
$statusBefore = & pnpm.cmd exec prisma migrate status --schema prisma/schema.prisma 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) { throw "MIGRATION_STATUS_FAILED" }
$deploy = & pnpm.cmd exec prisma migrate deploy --schema prisma/schema.prisma 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) { throw "MIGRATION_DEPLOY_FAILED" }
$statusAfter = & pnpm.cmd exec prisma migrate status --schema prisma/schema.prisma 2>&1 | Out-String
if ($LASTEXITCODE -ne 0 -or $statusAfter -notmatch "up to date|No pending migrations") { throw "MIGRATION_IDEMPOTENCY_FAILED" }

$sql = Get-Content -Raw "prisma/migrations/20260718190000_free_access_security/migration.sql"
if ($sql -match '(?im)DROP\s+(DATABASE|SCHEMA)|TRUNCATE\s+') { throw "DESTRUCTIVE_SQL_REJECTED" }
if ($sql -notmatch 'free_access_wallets' -or $sql -notmatch 'free_access_applications' -or $sql -notmatch 'free_access_credentials' -or $sql -notmatch 'free_access_sessions') { throw "SCHEMA_EQUIVALENCE_FAILED" }

$js = @'
(async()=>{const {PrismaClient}=await import("@prisma/client");const db=new PrismaClient();try{const m=await db.$queryRawUnsafe("SELECT current_database() AS db,inet_server_addr()::text AS host,current_setting($$server_version_num$$) AS v,(SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL) AS applied,(SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL AND logs IS NOT NULL) AS failed");const tables=await db.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema=$$public$$ AND table_name LIKE $$free_access_%$$ ORDER BY table_name");const constraints=await db.$queryRawUnsafe("SELECT count(*) FILTER (WHERE contype=$$f$$) AS fks FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname=$$public$$ AND r.relname LIKE $$free_access_%$$");const uniques=await db.$queryRawUnsafe("SELECT count(*) AS count FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$$public$$ AND c.relname LIKE $$free_access_%$$ AND i.indisunique");const indexes=await db.$queryRawUnsafe("SELECT count(*) AS count FROM pg_indexes WHERE schemaname=$$public$$ AND tablename LIKE $$free_access_%$$");const expected=["free_access_applications","free_access_audit_events","free_access_challenges","free_access_credentials","free_access_quotas","free_access_sessions","free_access_tokens","free_access_wallets"];const names=tables.map(x=>x.table_name);if(m[0].db.match(/^matchpulse_free_access_validation_/)===null||!(/127\.0\.0\.1|::1/.test(m[0].host))||String(m[0].v).slice(0,2)!=="16"||String(m[0].applied)!=="6"||String(m[0].failed)!=="0"||JSON.stringify(names)!==JSON.stringify(expected)||Number(uniques[0].count)<14||Number(constraints[0].fks)<3||Number(indexes[0].count)<15)process.exit(2);console.log("LOCAL_DB_HARNESS_CATALOG_OK");}finally{await db.$disconnect()}})()
'@
$encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($js))
node --input-type=module -e "eval(Buffer.from('$encoded','base64').toString())"
if ($LASTEXITCODE -ne 0) { throw "CATALOG_VERIFICATION_FAILED" }
Write-Output "LOCAL_DB_VALIDATION_HARNESS_OK"
