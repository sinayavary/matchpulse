/**
 * activate-txline-devnet.ts
 *
 * One-shot CLI script that performs the full TxLINE devnet activation flow:
 *   0. Preflight checks (env, wallet, RPC, activation fields, IDL status)
 *   1. Create on-chain subscription transaction
 *   2. Confirm transaction, capture txSig
 *   3. Build activation message from txSig + leagues + JWT
 *   4. Sign message with project wallet, Base64-encode signature
 *   5. POST signed payload to activation endpoint
 *   6. Extract API token from response
 *
 * The API token is NOT saved automatically. The user must manually copy it
 * into .env as TXLINE_API_TOKEN.
 *
 * **IMPORTANT:** The on-chain subscribe instruction layout requires TxLINE's
 * program IDL. This script blocks on the IDL check and will NOT send any
 * transaction until the real instruction data, account list, and PDA rules
 * are filled in below. See the IDL_MISSING guard and TODO list inside main().
 *
 * Usage (from apps/api):
 *   pnpm txline:activate-devnet
 *
 * Security:
 *   - Full JWT, API token, private key are never logged.
 *   - Only public key and sanitized previews are printed.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Connection,
  Keypair,
  Transaction,
  TransactionInstruction,
  PublicKey
} from "@solana/web3.js";
import nacl from "tweetnacl";

import {
  getActivationConfigFromEnv,
  buildActivationMessage,
  postActivationRequest,
  sanitizeJwt,
  TxlineActivationError
} from "@matchpulse/txline-client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Env loading (self-contained for scripts, same as activation-preflight.ts)
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

function loadWallet(): { keypair: Keypair; publicKey: string } {
  const keypairPath = process.env.SOLANA_KEYPAIR_PATH ?? "";
  const resolvedPath = path.resolve(repoRoot, keypairPath);

  if (!existsSync(resolvedPath)) {
    throw new Error(
      `Wallet file not found at ${resolvedPath}. Run txline:create-wallet first.`
    );
  }

  const raw = readFileSync(resolvedPath, "utf8");
  const secretKeyArray = JSON.parse(raw) as number[];
  const keypair = Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
  return { keypair, publicKey: keypair.publicKey.toBase58() };
}

// ---------------------------------------------------------------------------
// IDL / subscribe instruction availability
//
// Set IDL_KNOWN to true ONLY after the real TxLINE subscribe instruction
// layout, accounts, and PDA derivation rules have been added to this file.
// Until then the script will stop cleanly before sending any transaction.
// ---------------------------------------------------------------------------

const IDL_KNOWN = false;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("=== TxLINE Devnet Activation ===\n");

  // ===================================================================
  // Step 0: Preflight — env vars, wallet, RPC, activation fields
  // ===================================================================

  const activationConfig = getActivationConfigFromEnv();

  const missingBasics: string[] = [];
  if (!isPresent(process.env.TXLINE_GUEST_JWT)) missingBasics.push("TXLINE_GUEST_JWT");
  if (!isPresent(process.env.TXLINE_API_BASE_URL)) missingBasics.push("TXLINE_API_BASE_URL");
  if (!isPresent(process.env.TXLINE_RPC_URL)) missingBasics.push("TXLINE_RPC_URL");
  if (!isPresent(process.env.SOLANA_KEYPAIR_PATH)) missingBasics.push("SOLANA_KEYPAIR_PATH");

  const allMissing = [...missingBasics, ...activationConfig.missingFields];

  if (allMissing.length > 0) {
    console.error("Activation not ready. Missing fields:");
    for (const field of allMissing) {
      console.error(`  - ${field}`);
    }
    console.error(
      "\nPlease add these to your .env and consult TxLINE docs for the exact values."
    );
    process.exit(1);
    return;
  }

  // Load wallet
  const { keypair, publicKey } = loadWallet();
  const rpcUrl = process.env.TXLINE_RPC_URL!;
  const apiBaseUrl = process.env.TXLINE_API_BASE_URL!;
  const guestJwt = process.env.TXLINE_GUEST_JWT!;

  // ===================================================================
  // Diagnostics — print everything the transaction builder needs
  // (no secrets, only public keys and config values)
  // ===================================================================

  console.log("Diagnostics:");
  console.log(`  wallet_public_key:   ${publicKey}`);
  console.log(`  network:             ${process.env.TXLINE_NETWORK ?? "devnet"}`);
  console.log(`  api_base_url:        ${apiBaseUrl}`);
  console.log(`  rpc_url:             ${rpcUrl}`);
  console.log(`  program_id:          ${activationConfig.programId}`);
  console.log(`  txl_token_mint:      ${activationConfig.txlTokenMint}`);
  console.log(`  duration_weeks:       ${activationConfig.durationWeeks}`);
  console.log(`  service_level_id:    ${process.env.TXLINE_SERVICE_LEVEL_ID}`);
  console.log(`  selected_leagues:     "${activationConfig.selectedLeagues}"`);
  console.log(`  guest_jwt_configured: true`);
  console.log();

  // ===================================================================
  // IDL guard — do NOT send a placeholder transaction
  // ===================================================================

  if (!IDL_KNOWN) {
    console.error("Activation not ready. Missing TxLINE subscribe IDL/accounts.\n");
    console.error("The on-chain subscribe instruction layout is not yet implemented.");
    console.error("No transaction will be sent until the following are resolved:\n");
    console.error("TODO — required from TxLINE program IDL or activation docs:");
    console.error("  1. subscribe instruction discriminator / layout (Borsh / Anchor)");
    console.error("  2. required accounts list (wallet, mint, ATA, PDA, system program, ...)");
    console.error("  3. PDA derivation rules (seeds, program, bump)");
    console.error("  4. service level account (if any separate on-chain account)");
    console.error("  5. subscription account (if any)");
    console.error("  6. treasury / payment account (if token transfer required)");
    console.error("  7. token program / associated token program requirements");
    console.error("  8. selectedLeagues encoding format");
    console.error("  9. activation endpoint URL (confirmed, e.g. /api/token/activate)");
    console.error("  10. activation request payload shape");
    console.error("  11. activation response format (which field has the API token)");
    console.error("  12. activation message format (what bytes the wallet must sign)");
    console.error();
    console.error(
      "Once the IDL is available, set IDL_KNOWN = true at the top of this file " +
      "and implement the real subscribe instruction below the IDL_KNOWN guard."
    );
    process.exit(1);
    return;
  }

  // ===================================================================
  // Step 1: On-chain subscription transaction
  //
  // IMPLEMENT HERE: the real subscribe instruction based on TxLINE IDL.
  //
  // This code will only execute when IDL_KNOWN is set to true above.
  // Every account and field is validated before the transaction is built.
  // ===================================================================

  console.log("Step 1: Creating on-chain subscription transaction...");

  const connection = new Connection(rpcUrl, "confirmed");

  // Validate all account public keys exist
  const programId = activationConfig.programId
    ? new PublicKey(activationConfig.programId)
    : undefined;

  if (!programId) {
    console.error("programId is undefined. Cannot build transaction.");
    process.exit(1);
    return;
  }

  const txlMint = activationConfig.txlTokenMint
    ? new PublicKey(activationConfig.txlTokenMint)
    : undefined;

  if (!txlMint) {
    console.error("txlTokenMint is undefined. Cannot build transaction.");
    process.exit(1);
    return;
  }

  // TODO: Add all required accounts for the subscribe instruction here.
  // Example (unconfirmed):
  //   const [subscriptionPda] = PublicKey.findProgramAddressSync(
  //     [Buffer.from("subscription"), walletPubkey.toBuffer()],
  //     programId
  //   );
  //   const ata = getAssociatedTokenAddressSync(txlMint, walletPubkey);
  const accounts: Array<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }> = [];

  // Validate every account
  for (const account of accounts) {
    if (!account.pubkey) {
      console.error("Transaction account has undefined publicKey. Aborting.");
      process.exit(1);
      return;
    }
  }

  // TODO: Replace with real instruction data based on TxLINE IDL.
  const instructionData = Buffer.alloc(0);

  if (instructionData.length === 0) {
    console.error(
      "Instruction data is empty — subscribe instruction not implemented. Aborting."
    );
    process.exit(1);
    return;
  }

  const instruction = new TransactionInstruction({
    keys: accounts,
    programId,
    data: instructionData
  });

  // Validate instruction before building transaction
  if (!instruction.programId || !instruction.keys || !instruction.data) {
    console.error("Built instruction has undefined fields. Aborting.");
    process.exit(1);
    return;
  }

  const transaction = new Transaction().add(instruction);
  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = latestBlockhash.blockhash;
  transaction.lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;

  // Sign correctly: transaction.sign() mutates in-place and returns void.
  transaction.sign(keypair);
  const serialized = transaction.serialize();

  // ===================================================================
  // Step 2: Send and confirm
  // ===================================================================

  console.log("Step 2: Sending and confirming transaction...");

  const txSig = await connection.sendRawTransaction(serialized, {
    skipPreflight: false,
    preflightCommitment: "confirmed"
  });

  await connection.confirmTransaction(
    {
      signature: txSig,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
    },
    "confirmed"
  );

  console.log(`Transaction confirmed: ${txSig}`);

  // ===================================================================
  // Step 3: Build and sign activation message
  // ===================================================================

  console.log("Step 3: Building activation message...");
  const activationMessage = buildActivationMessage(
    txSig,
    activationConfig.selectedLeagues,
    guestJwt
  );

  console.log("Step 4: Signing activation message...");
  const signature = nacl.sign.detached(activationMessage, keypair.secretKey);
  const walletSignatureBase64 = Buffer.from(signature).toString("base64");

  // ===================================================================
  // Step 5: POST to activation endpoint
  // ===================================================================

  console.log("Step 5: Calling activation endpoint...");
  const apiToken = await postActivationRequest({
    apiBaseUrl,
    guestJwt,
    txSignature: txSig,
    walletSignatureBase64,
    walletPublicKey: publicKey,
    selectedLeagues: activationConfig.selectedLeagues
  });

  const preview = sanitizeJwt(apiToken);
  console.log("\nSuccess!");
  console.log(`API token preview: ${preview}`);
  console.log(
    "\nNext step: copy the full API token into your .env as TXLINE_API_TOKEN"
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Unexpected error: ${message}`);
  process.exit(1);
});
