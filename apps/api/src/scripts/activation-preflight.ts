import { runActivationPreflight } from "@matchpulse/txline-client";
import "../load-env.js";

async function main(): Promise<void> {
  const result = await runActivationPreflight();

  console.log("=== TxLINE Activation Preflight ===");
  console.log(`rpc_connected: ${result.rpcConnected}`);
  console.log(`wallet_file_exists: ${result.walletFileExists}`);
  console.log(`wallet_public_key_loaded: ${result.walletPublicKey !== null}`);
  console.log(`wallet_public_key: ${result.walletPublicKey ?? "<not loaded>"}`);
  console.log(
    `wallet_balance: ${result.walletBalanceSol === null ? "<could not fetch>" : `${result.walletBalanceSol} SOL`}`
  );
  console.log(`wallet_balance_sufficient: ${result.walletBalanceSol !== null && result.walletBalanceSol >= 0.1}`);
  console.log(`guest_jwt_configured: ${result.guestJwtConfigured}`);
  console.log(`api_token_configured: ${result.apiTokenConfigured}`);
  console.log(`api_base_configured: ${result.apiBaseConfigured}`);
  console.log(`service_level_configured: ${result.serviceLevelConfigured}`);
  console.log(`duration_weeks_configured: ${result.durationWeeksConfigured}`);
  console.log(`duration_weeks_valid: ${result.durationWeeks !== null && result.durationWeeks >= 4 && result.durationWeeks % 4 === 0}`);
  console.log(`program_id_valid: ${result.programIdValid}`);
  console.log(`txl_token_mint_valid: ${result.tokenMintValid}`);
  console.log(`official_idl_loaded: ${result.idlLoaded}`);
  console.log(`subscribe_instruction_exists: ${result.subscribeInstructionImplemented}`);
  console.log(`subscribe_accounts_valid: ${result.subscribeAccountsValid}`);
  console.log(`pda_ata_derivation_succeeded: ${result.derivationSucceeded}`);
  console.log(`user_token_account_address: ${result.userTokenAccountAddress ?? "<could not derive>"}`);
  console.log(`user_token_account_initialized: ${result.userTokenAccountInitialized}`);
  console.log(`user_token_account_will_be_created: ${result.userTokenAccountWillBeCreated}`);
  console.log(`activation_endpoint_valid: ${result.activationEndpointValid}`);
  console.log(`selected_leagues_valid: ${result.selectedLeagues !== null}`);
  console.log(`subscribe_instruction_implemented: ${result.subscribeInstructionImplemented && result.subscribeAccountsValid}`);
  console.log(`activation_ready: ${result.activationReady}`);

  if (!result.activationReady) {
    console.log("missing_or_invalid:");
    for (const item of result.invalidItems) console.log(`  - ${item}`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`activation_ready: false\npreflight_error: ${message}`);
  process.exitCode = 1;
});
