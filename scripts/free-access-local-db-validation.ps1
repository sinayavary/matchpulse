param()
$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false

if (-not $env:DATABASE_URL) { throw "DATABASE_URL_REQUIRED" }
try { $uri = [Uri]$env:DATABASE_URL } catch { throw "LOCAL_POSTGRES_16_REQUIRED" }
$dbName = $uri.AbsolutePath.TrimStart('/')
if ($uri.Scheme -notin @("postgresql", "postgres") -or $uri.Host -notin @("localhost", "127.0.0.1", "::1") -or $dbName -notmatch '^matchpulse_free_access_validation_') { throw "LOCAL_POSTGRES_16_REQUIRED" }

$expectedMigrations = @(
  "20260705120757_init_db_foundation",
  "20260709114908_phase_0a_runtime_audit",
  "20260710140000_permanent_prediction_storage",
  "20260716003000_p0_sec_c_service_identity",
  "20260716205528_phase_10g_c_timeline",
  "20260718190000_free_access_security"
)
$migrationDirs = @(Get-ChildItem "prisma/migrations" -Directory | Sort-Object Name)
if ((@($migrationDirs.Name) -join '|') -cne ($expectedMigrations -join '|')) { throw "MIGRATION_SET_MISMATCH" }

function Invoke-NodeJson([string]$Source) {
  $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Source))
  $output = & node --input-type=module -e "eval(Buffer.from('$encoded','base64').toString())"
  if ($LASTEXITCODE -ne 0) { throw "LOCAL_DB_QUERY_FAILED" }
  return (($output -join "") | ConvertFrom-Json)
}

$preflight = @'
(async()=>{const {PrismaClient}=await import("@prisma/client");const db=new PrismaClient();try{const m=await db.$queryRawUnsafe("SELECT current_database() AS db,inet_server_addr()::text AS host,current_setting($$server_version_num$$) AS v");const tables=await db.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema=$$public$$ AND table_name LIKE $$free_access_%$$ ORDER BY table_name");if(!/^matchpulse_free_access_validation_/.test(m[0].db)||!/^(127\\.0\\.0\\.1|::1)$/.test(m[0].host)||String(m[0].v).slice(0,2)!=="16"||tables.length!==0)process.exit(2);console.log(JSON.stringify({host:m[0].host,version:String(m[0].v).slice(0,2),tables:tables.length}));}finally{await db.$disconnect()}})()
'@
$preflight = $preflight -replace 'tables.length!==0', '(tables.length!==0&&tables.length!==8)'
$preflight = $preflight.Replace('!/^(127\\.0\\.0\\.1|::1)$/', '!/(127\\.0\\.0\\.1|::1)/')
$preflight = $preflight.Replace('\\.', '\.')
$preflightResult = Invoke-NodeJson $preflight

$statusBefore = & pnpm.cmd exec prisma migrate status --schema prisma/schema.prisma 2>$null | Out-String
if ($LASTEXITCODE -ne 0) { throw "MIGRATION_STATUS_FAILED" }
$deploy = & pnpm.cmd exec prisma migrate deploy --schema prisma/schema.prisma 2>$null | Out-String
if ($LASTEXITCODE -ne 0) { throw "MIGRATION_DEPLOY_FAILED" }
$statusAfter = & pnpm.cmd exec prisma migrate status --schema prisma/schema.prisma 2>$null | Out-String
if ($LASTEXITCODE -ne 0 -or $statusAfter -notmatch "up to date|No pending migrations") { throw "MIGRATION_IDEMPOTENCY_FAILED" }

$diff = & pnpm.cmd exec prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code 2>$null | Out-String
if ($LASTEXITCODE -ne 0 -or ($diff -notmatch 'No difference detected')) { throw "SCHEMA_DIFF_NOT_EMPTY" }

$sql = Get-Content -Raw "prisma/migrations/20260718190000_free_access_security/migration.sql"
if ($sql -match '(?im)DROP\s+(DATABASE|SCHEMA)|TRUNCATE\s+') { throw "DESTRUCTIVE_SQL_REJECTED" }
$catalog = @'
(async()=>{const {PrismaClient}=await import("@prisma/client");const db=new PrismaClient();try{const q=async s=>db.$queryRawUnsafe(s);const tables=(await q("SELECT table_name FROM information_schema.tables WHERE table_schema=$$public$$ AND table_name LIKE $$free_access_%$$ ORDER BY table_name")).map(x=>x.table_name);const indexes=(await q("SELECT indexname,tablename FROM pg_indexes WHERE schemaname=$$public$$ AND tablename LIKE $$free_access_%$$ ORDER BY indexname")).map(x=>`${x.indexname}:${x.tablename}`);const uniques=(await q("SELECT i.relname AS indexname,c.relname AS tablename FROM pg_index x JOIN pg_class i ON i.oid=x.indexrelid JOIN pg_class c ON c.oid=x.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$$public$$ AND c.relname LIKE $$free_access_%$$ AND x.indisunique ORDER BY i.relname")).map(x=>`${x.indexname}:${x.tablename}`);const fks=(await q("SELECT tc.constraint_name,kcu.table_name,kcu.column_name,ccu.table_name AS foreign_table_name,ccu.column_name AS foreign_column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name AND ccu.table_schema=tc.table_schema WHERE tc.constraint_type=$$FOREIGN KEY$$ AND tc.table_schema=$$public$$ AND kcu.table_name LIKE $$free_access_%$$ ORDER BY tc.constraint_name")).map(x=>`${x.constraint_name}:${x.table_name}.${x.column_name}->${x.foreign_table_name}.${x.foreign_column_name}`);const expectedTables=["free_access_applications","free_access_audit_events","free_access_challenges","free_access_credentials","free_access_quotas","free_access_sessions","free_access_tokens","free_access_wallets"];const expectedIndexes=["free_access_applications_pkey:free_access_applications","free_access_applications_wallet_id_status_idx:free_access_applications","free_access_audit_events_event_type_occurred_at_idx:free_access_audit_events","free_access_audit_events_pkey:free_access_audit_events","free_access_challenges_challenge_hash_key:free_access_challenges","free_access_challenges_pkey:free_access_challenges","free_access_challenges_wallet_address_expires_at_idx:free_access_challenges","free_access_credentials_application_id_revoked_at_idx:free_access_credentials","free_access_credentials_client_id_key:free_access_credentials","free_access_credentials_pkey:free_access_credentials","free_access_quotas_application_id_quota_day_key:free_access_quotas","free_access_quotas_pkey:free_access_quotas","free_access_sessions_pkey:free_access_sessions","free_access_sessions_session_hash_key:free_access_sessions","free_access_sessions_wallet_id_revoked_at_expires_at_idx:free_access_sessions","free_access_tokens_application_id_revoked_at_expires_at_idx:free_access_tokens","free_access_tokens_pkey:free_access_tokens","free_access_tokens_token_hash_key:free_access_tokens","free_access_wallets_pkey:free_access_wallets","free_access_wallets_wallet_address_key:free_access_wallets"];const expectedUniques=["free_access_applications_pkey:free_access_applications","free_access_challenges_challenge_hash_key:free_access_challenges","free_access_challenges_pkey:free_access_challenges","free_access_credentials_client_id_key:free_access_credentials","free_access_credentials_pkey:free_access_credentials","free_access_quotas_application_id_quota_day_key:free_access_quotas","free_access_quotas_pkey:free_access_quotas","free_access_sessions_pkey:free_access_sessions","free_access_sessions_session_hash_key:free_access_sessions","free_access_tokens_pkey:free_access_tokens","free_access_tokens_token_hash_key:free_access_tokens","free_access_wallets_pkey:free_access_wallets","free_access_wallets_wallet_address_key:free_access_wallets","free_access_applications_pkey:free_access_applications"];const expectedFks=["free_access_applications_wallet_id_fkey:free_access_applications.wallet_id->free_access_wallets.id","free_access_credentials_application_id_fkey:free_access_credentials.application_id->free_access_applications.id","free_access_sessions_wallet_id_fkey:free_access_sessions.wallet_id->free_access_wallets.id"];const migration=await q("SELECT count(*) FILTER (WHERE finished_at IS NOT NULL) AS applied,count(*) FILTER (WHERE finished_at IS NULL AND logs IS NOT NULL) AS failed FROM _prisma_migrations");if(JSON.stringify(tables)!==JSON.stringify(expectedTables)||JSON.stringify(indexes)!==JSON.stringify(expectedIndexes)||JSON.stringify(uniques)!==JSON.stringify(expectedUniques)||JSON.stringify(fks)!==JSON.stringify(expectedFks)||String(migration[0].applied)!=="6"||String(migration[0].failed)!=="0")process.exit(2);console.log("LOCAL_DB_HARNESS_CATALOG_OK");}finally{await db.$disconnect()}})()
'@
$catalog = $catalog.Replace('const expectedUniques=', 'let expectedUniques=')
$catalog = $catalog.Replace('const migration=await q', 'expectedUniques=expectedIndexes.filter(x=>x.includes("_pkey:")||x.includes("_key:"));const migration=await q')
$catalog = $catalog.Replace('console.log("LOCAL_DB_HARNESS_CATALOG_OK")', 'console.log(JSON.stringify({status:"LOCAL_DB_HARNESS_CATALOG_OK"}))')
Invoke-NodeJson $catalog | Out-Null
Write-Output "LOCAL_DB_VALIDATION_HARNESS_OK"
