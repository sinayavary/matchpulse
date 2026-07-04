/**
 * activation-preflight.ts
 *
 * One-shot CLI script that checks whether all prerequisites for TxLINE
 * on-chain activation are in place. It is informational — it never performs
 * activation, never sends transactions, and never calls the activation endpoint.
 *
 * It reads only from the monorepo root .env and the secrets/ directory.
 * No secrets are printed. Only booleans and the wallet public key are shown.
 *
 * Exit code is always 0 (preflight is a diagnostic, not a gate).
 *
 * Usage (from apps/api):
 *   pnpm txline:activation-preflight
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Env loading (same pattern as load-env.ts but self-contained for scripts)
// ---------------------------------------------------------------------------

function findRepoRoot(startDir: string): string {
  let current = startDir;
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(path.join(current, "pnpm-workspace.yaml"))) return current;
    const next = path.dirname(current);
    if (next === current) break;
    current = next;
  }
  return path.resolve(startDir, "..", "..", "..", "..");
}

import dotenv from "dotenv";
const repoRoot = findRepoRoot(__dirname);
const envPath = path.join(repoRoot, ".env");
if (existsSync(envPath)) {
  dotenv.config({ path: envPath, override: true });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPresent(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function boolLabel(value: string | undefined): string {
  return isPresent(value) ? "true" : "false";
}

// ---------------------------------------------------------------------------
// IDL / subscribe instruction availability
//
// Mirrors the same flag in activate-txline-devnet.ts so preflight can
// accurately report whether the activation script would proceed or block.
// ---------------------------------------------------------------------------

const IDL_KNOWN = false;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const env = process.env;

  // --- Basic config ---
  const network = env.TXLINE_NETWORK ?? "devnet";
  const serviceLevelId = env.TXLINE_SERVICE_LEVEL_ID ?? "(not set)";
  const apiBaseUrlConfigured = isPresent(env.TXLINE_API_BASE_URL);
  const rpcUrl = env.TXLINE_RPC_URL ?? "";

  // --- Credentials (booleans only, no values) ---
  const guestJwtConfigured = isPresent(env.TXLINE_GUEST_JWT);
  const apiTokenConfigured = isPresent(env.TXLINE_API_TOKEN);

  // --- Activation-specific fields ---
  const programIdConfigured = isPresent(env.TXLINE_PROGRAM_ID);
  const txlTokenMintConfigured = isPresent(env.TXLINE_TXL_TOKEN_MINT);
  const durationWeeksConfigured = isPresent(env.TXLINE_DURATION_WEEKS);
  const selectedLeagues = env.TXLINE_SELECTED_LEAGUES ?? "";
  const selectedLeaguesConfigured = isPresent(env.TXLINE_SELECTED_LEAGUES);

  // --- Wallet ---
  const keypairPath = env.SOLANA_KEYPAIR_PATH ?? "";
  const resolvedKeypairPath = path.resolve(repoRoot, keypairPath);
  const walletFileExists = existsSync(resolvedKeypairPath);

  let walletPublicKey = "<not loaded>";
  let walletBalanceSol = -1;
  let rpcConnected = false;

  if (walletFileExists && rpcUrl) {
    try {
      const raw = readFileSync(resolvedKeypairPath, "utf8");
      const secretKeyArray = JSON.parse(raw) as number[];
      const keypair = Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
      walletPublicKey = keypair.publicKey.toBase58();

      const connection = new Connection(rpcUrl, "confirmed");
      const lamports = await connection.getBalance(keypair.publicKey, "confirmed");
      walletBalanceSol = lamports / LAMPORTS_PER_SOL;

      // RPC connectivity proven by successful getBalance above.
      rpcConnected = true;
    } catch {
      // Wallet or RPC issue — values stay at defaults.
    }
  } else if (rpcUrl && !walletFileExists) {
    // Try RPC alone
    try {
      const connection = new Connection(rpcUrl, "confirmed");
      await connection.getSlot("confirmed");
      rpcConnected = true;
    } catch {
      // RPC unreachable
    }
  }

  // --- Output ---
  console.log("=== TxLINE Activation Preflight ===\n");

  console.log("Network config:");
  console.log(`  network:              ${network}`);
  console.log(`  service_level_id:     ${serviceLevelId}`);
  console.log(`  api_base_configured:  ${apiBaseUrlConfigured}`);
  console.log(`  rpc_connected:         ${rpcConnected}`);

  console.log("\nCredentials (presence only):");
  console.log(`  guest_jwt_configured: ${boolLabel(env.TXLINE_GUEST_JWT)}`);
  console.log(`  api_token_configured: ${boolLabel(env.TXLINE_API_TOKEN)}`);

  console.log("\nWallet:");
  console.log(`  wallet_file_exists:   ${walletFileExists}`);
  console.log(`  wallet_public_key:    ${walletPublicKey}`);
  if (walletBalanceSol >= 0) {
    const sufficient = walletBalanceSol >= 0.1;
    console.log(`  wallet_balance:       ${walletBalanceSol} SOL (${sufficient ? "sufficient" : "insufficient, need >= 0.1 SOL"})`);
  } else {
    console.log(`  wallet_balance:       <could not fetch>`);
  }

  console.log("\nOn-chain activation fields:");
  console.log(`  program_id_configured:       ${boolLabel(env.TXLINE_PROGRAM_ID)}`);
  console.log(`  txl_token_mint_configured:    ${boolLabel(env.TXLINE_TXL_TOKEN_MINT)}`);
  console.log(`  duration_weeks_configured:    ${boolLabel(env.TXLINE_DURATION_WEEKS)}`);
  console.log(`  selected_leagues_configured:  ${selectedLeaguesConfigured}`);
  console.log(`  selected_leagues_value:      "${selectedLeagues}"`);

  console.log("\nIDL / subscribe instruction status:");
  console.log(`  idl_known:             ${IDL_KNOWN}`);
  console.log(`  subscribe_instruction_implemented: ${IDL_KNOWN}`);

  // --- Missing fields report ---
  const missingFields: string[] = [];
  if (!programIdConfigured) missingFields.push("TXLINE_PROGRAM_ID");
  if (!txlTokenMintConfigured) missingFields.push("TXLINE_TXL_TOKEN_MINT");
  if (!durationWeeksConfigured) missingFields.push("TXLINE_DURATION_WEEKS");

  // Also report missing basics that block activation
  if (!guestJwtConfigured) missingFields.push("TXLINE_GUEST_JWT");
  if (!walletFileExists) missingFields.push("SOLANA_KEYPAIR_PATH (wallet file not found)");
  if (!rpcConnected) missingFields.push("TXLINE_RPC_URL (RPC unreachable)");

  console.log();
  if (missingFields.length > 0) {
    console.log("Activation not ready. Missing fields:");
    for (const field of missingFields) {
      console.log(`  - ${field}`);
    }
  }

  // --- IDL / subscribe instruction TODO list ---
  if (!IDL_KNOWN) {
    console.log("\nActivation not ready. Missing TxLINE subscribe IDL/accounts.");
    console.log("The following must be obtained from TxLINE docs/Discord/GitHub:\n");
    console.log("  1. subscribe instruction discriminator / layout (Borsh / Anchor)");
    console.log("  2. required accounts list (wallet, mint, ATA, PDA, system program, ...)");
    console.log("  3. PDA derivation rules (seeds, program, bump)");
    console.log("  4. service level account (if any separate on-chain account)");
    console.log("  5. subscription account (if any)");
    console.log("  6. treasury / payment account (if token transfer required)");
    console.log("  7. token program / associated token program requirements");
    console.log("  8. selectedLeagues encoding format");
    console.log("  9. activation endpoint URL (confirmed, e.g. /api/token/activate)");
    console.log("  10. activation request payload shape");
    console.log("  11. activation response format (which field has the API token)");
    console.log("  12. activation message format (what bytes the wallet must sign)");
    console.log();
    console.log(
      "Once the IDL is available, set IDL_KNOWN = true in both scripts and " +
      "implement the real subscribe instruction."
    );
  } else if (missingFields.length === 0) {
    console.log("All known activation fields are configured and IDL is implemented. Ready to attempt activation.");
  } else {
    console.log("IDL is implemented but env fields are still missing (see above).");
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Preflight error: ${message}`);
  process.exit(0); // preflight always exits 0
});
