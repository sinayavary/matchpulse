# MatchPulse Human Input Response Template

Use this template to resolve project inputs without sending secret values through chat or committing them to Git.

For secret-bearing items, provide only:

- the environment or secret-store location;
- the environment-variable names;
- whether Codex may validate their presence;
- whether Codex may use them in development, staging, or production;
- the approved time window and operation scope.

Never paste private keys, tokens, passwords, wallet seeds, or provider credentials into this document.

## A. Product and release scope

```yaml
product_scope_priority:
  approved: true
  notes: ""

supported_competitions:
  competition_ids_or_names: []
  season_scope: []
  priority_order: []
  excluded_competitions: []

supported_languages:
  languages: [fa, en]
  default_language: fa
  rtl_required: true

release_policy:
  release_type: demo | private_beta | public_beta | production
  versioning_scheme: semver
  required_environments: [development, staging, production]
  smoke_test_owner: ""
  rollback_owner: ""
  launch_window: ""
  demo_or_production: ""
  known_limitations_approval: false
  release_notes_audience: ""
```

## B. Brand and user experience

```yaml
brand_and_ux:
  product_name: MatchPulse
  tagline: ""
  logo_status: missing | draft | approved
  visual_direction: ""
  primary_audience: ""
  languages: [fa, en]
  accessibility_target: WCAG_2_2_AA
  mobile_priority: true
  reference_products_to_emulate: []
  reference_products_to_avoid: []
```

## C. Public API

```yaml
public_api_policy:
  public_or_authenticated: authenticated | public_read_only | mixed
  consumer_types: []
  versioning_policy: url_versioned
  rate_limit_policy: ""
  exposed_fields: []
  forbidden_fields:
    - provider_payload
    - provider_identity
    - specialist_contributions
    - assigned_weights
    - feature_hash
    - private_policy
    - proof_blob
  retention_and_cache_policy: ""
  breaking_change_policy: ""
```

## D. Database and migrations

```yaml
database_development:
  engine: postgresql
  major_version: ""
  environment_name: ""
  connection_variable_name: DATABASE_URL
  ssl_mode: ""
  backup_available: false
  restore_tested: false
  data_classification: ""
  retention_days: 0
  maximum_expected_fixtures: 0
  maximum_expected_events_per_fixture: 0

migration_authority:
  development_approval: ""
  staging_approval: ""
  production_approval: ""
  backup_requirement: ""
  rollback_requirement: ""
  maintenance_window_policy: ""
  zero_downtime_required: false
```

## E. TxLINE

```yaml
txline_environment:
  environment: mock | devnet | staging | production
  base_url: ""
  sse_origin: ""
  credential_variable_names: []
  wallet_required_for_operator_only: true
  rate_limits: ""
  quota: ""
  fixture_scope: ""
  proof_endpoints_enabled: false
  data_retention_terms: ""
  provider_support_contact: ""
  allowed_test_window: ""
  codex_may_validate_presence: false
  codex_may_access_network: false
```

## F. Private model policy and quality targets

```yaml
private_model_policy:
  adapter_type: local_module | internal_service | managed_model_service
  runtime_location: ""
  configuration_variable_names: []
  model_versions: []
  fallback_policy: ""
  calibration_artifact_location: ""
  rotation_policy: ""
  owner: ""
  audit_requirement: ""

prediction_quality_targets:
  minimum_evaluation_sample_size: 0
  maximum_multiclass_log_loss_by_target: {}
  maximum_brier_score_by_target: {}
  maximum_expected_calibration_error: 0.0
  minimum_data_coverage: 0.0
  maximum_stale_fraction: 0.0
  minimum_segment_support: 0
  acceptable_known_limitations: []
```

## G. Notifications and Telegram

```yaml
notification_policy:
  channels: [telegram]
  opt_in_required: true
  cooldown_minutes: 0
  daily_limit: 0
  quiet_hours: ""
  material_change_policy_source: private_runtime_policy
  supported_languages: [fa, en]
  unsubscribe_behavior: ""
  retention_policy: ""

telegram_environment:
  bot_token_variable_name: TELEGRAM_BOT_TOKEN
  webhook_or_polling: webhook | polling
  webhook_domain: ""
  allowed_chat_policy: ""
  test_chat_id_variable_name: TELEGRAM_TEST_CHAT_ID
  production_chat_scope: ""
  rate_limit_policy: ""
  codex_may_validate_presence: false
  codex_may_send_test_message: false
```

## H. Solana verification

```yaml
solana_environment:
  cluster: devnet | testnet | mainnet_beta
  rpc_url_variable_name: SOLANA_RPC_URL
  program_ids: []
  wallet_variable_name: SOLANA_OPERATOR_KEYPAIR
  wallet_role: verification_only | transaction_authority
  maximum_spend: "0"
  transaction_allowed: false
  commitment_level: confirmed
  retry_policy: ""
  explorer_base_url: ""
  operator_approval: false
  codex_may_validate_presence: false
  codex_may_access_rpc: false
```

## I. Hosting, DNS and observability

```yaml
hosting_and_deployment:
  cloud_or_platform: ""
  region: ""
  runtime: containers | serverless | virtual_machine
  container_registry: ""
  database_service: ""
  cache_service: ""
  secret_store: ""
  ci_cd_platform: github_actions
  staging_environment: ""
  production_environment: ""
  budget_limit: ""
  autoscaling_policy: ""
  availability_target: ""
  deployment_method: rolling | blue_green | canary

domain_and_dns:
  primary_domain: ""
  api_subdomain: ""
  web_subdomain: ""
  telegram_webhook_subdomain: ""
  dns_provider: ""
  tls_management: ""
  owner: ""
  change_approval: ""

observability_environment:
  logs_platform: ""
  metrics_platform: ""
  tracing_platform: ""
  error_tracking: ""
  credential_variable_names: []
  retention_days: 0
  alert_channels: []
  on_call_owner: ""
  monthly_budget: ""
```

## J. Security and privacy

```yaml
security_policy:
  approved: false
  compliance_requirements: []
  data_residency: ""
  incident_contact: ""
  penetration_test_required: false
  critical_open_findings: 0
  high_open_findings: 0
  dependency_scanning: true
  secret_scanning: true
  container_scanning: true
  least_privilege: true
  log_redaction: true
  production_mfa: true

privacy_and_retention:
  jurisdictions: []
  personal_data_collected: []
  legal_basis: ""
  retention_by_data_type: {}
  deletion_process: ""
  analytics_cookies: false
  privacy_contact: ""
  terms_required: false
  age_policy: ""
```

## Approval statement

```yaml
approval:
  approved_input_ids: []
  approved_by: ""
  approved_at_utc: ""
  scope: development | staging | production
  notes: ""
```
