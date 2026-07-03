/**
 * create-dev-wallet.ts
 *
 * Bootstraps a Solana devnet keypair used ONLY for backend TxLINE devnet
 * activation (service-level access, API token provisioning, etc).
 *
 * This is not a user-facing wallet flow:
 *   - Normal MatchPulse app users never connect a wallet.
 *   - The frontend never talks to TxLINE or Solana directly.
 *   - This script is a one-time/idempotent ops utility run manually by a
 *     backend developer against devnet.
 *
 * Secrets always live at the monorepo root (not inside apps/api), so they
 * stay in one predictable, gitignored place regardless of which workspace
 * package the script is invoked from:
 *   <repoRoot>/secrets/matchpulse-dev-wallet.json
 *   <repoRoot>/secrets/matchpulse-dev-wallet.pub.txt
 *
 * Usage (from apps/api):
 *   pnpm txline:create-wallet
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Walks up from this file looking for the monorepo root, identified by
 * pnpm-workspace.yaml. Falls back to the conventional apps/api/src/scripts
 * -> repoRoot depth if the marker can't be found for some reason, so the
 * script still lands secrets outside of apps/api rather than inside it.
 */
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

const repoRoot = findRepoRoot(__dirname);
const secretsDir = path.join(repoRoot, "secrets");
const secretKeyPath = path.join(secretsDir, "matchpulse-dev-wallet.json");
const publicKeyPath = path.join(secretsDir, "matchpulse-dev-wallet.pub.txt");

const DEVNET_RPC_URL = "https://api.devnet.solana.com";
const MIN_BALANCE_SOL = 0.1;
const AIRDROP_AMOUNTS_SOL = [1, 0.5, 0.1];

function ensureSecretsDir(): void {
  if (!existsSync(secretsDir)) {
    // 0o700: only the owner can read/list this directory.
    mkdirSync(secretsDir, { recursive: true, mode: 0o700 });
  }
}

/**
 * Loads the existing dev wallet keypair from disk, or generates a new one
 * and persists it, if none exists yet. An existing wallet is always loaded
 * as-is and never overwritten. Never logs or returns the secret key
 * material beyond the in-memory Keypair object.
 */
function loadOrCreateKeypair(): { keypair: Keypair; isNew: boolean } {
  if (existsSync(secretKeyPath)) {
    const raw = readFileSync(secretKeyPath, "utf8");
    const secretKeyArray = JSON.parse(raw) as number[];
    const keypair = Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
    return { keypair, isNew: false };
  }

  const keypair = Keypair.generate();
  const secretKeyArray = Array.from(keypair.secretKey);

  // 0o600: only the owner can read/write this file. Written only to the
  // gitignored secrets/ directory, never embedded in source.
  writeFileSync(secretKeyPath, JSON.stringify(secretKeyArray), { mode: 0o600 });
  writeFileSync(publicKeyPath, keypair.publicKey.toBase58(), { mode: 0o600 });

  return { keypair, isNew: true };
}

async function getBalanceSol(connection: Connection, keypair: Keypair): Promise<number> {
  const lamports = await connection.getBalance(keypair.publicKey, "confirmed");
  return lamports / LAMPORTS_PER_SOL;
}

/**
 * Attempts a single airdrop of the given SOL amount. Never throws: any
 * failure (rate limiting, faucet 429s, RPC internal errors, confirmation
 * timeouts, etc) is swallowed and reported as a null result so the caller
 * can fall through to the next, smaller amount.
 */
async function tryAirdrop(
  connection: Connection,
  keypair: Keypair,
  amountSol: number
): Promise<string | null> {
  try {
    const signature = await connection.requestAirdrop(
      keypair.publicKey,
      Math.round(amountSol * LAMPORTS_PER_SOL)
    );

    const latestBlockhash = await connection.getLatestBlockhash("confirmed");
    await connection.confirmTransaction(
      {
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
      },
      "confirmed"
    );

    return signature;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Diagnostic only, sent to stderr so stdout stays limited to the
    // required public-facing lines.
    console.error(`Airdrop attempt of ${amountSol} SOL failed: ${message}`);
    return null;
  }
}

async function main(): Promise<void> {
  ensureSecretsDir();

  const { keypair, isNew } = loadOrCreateKeypair();

  // Keep the .pub.txt in sync even if only the secret file existed
  // (e.g. it was restored from a backup without the companion pub file).
  if (!isNew && !existsSync(publicKeyPath)) {
    writeFileSync(publicKeyPath, keypair.publicKey.toBase58(), { mode: 0o600 });
  }

  const connection = new Connection(DEVNET_RPC_URL, "confirmed");
  const publicKey = keypair.publicKey.toBase58();
  const initialBalanceSol = await getBalanceSol(connection, keypair);

  // Required, unconditional output.
  console.log(`Public key: ${publicKey}`);
  console.log(`Balance: ${initialBalanceSol} SOL`);

  if (initialBalanceSol >= MIN_BALANCE_SOL) {
    // Wallet already sufficiently funded: nothing more to do.
    return;
  }

  for (const amountSol of AIRDROP_AMOUNTS_SOL) {
    const signature = await tryAirdrop(connection, keypair, amountSol);
    if (signature) {
      const newBalanceSol = await getBalanceSol(connection, keypair);
      console.log(`Airdrop succeeded: ${amountSol} SOL (tx signature: ${signature})`);
      console.log(`Balance: ${newBalanceSol} SOL`);
      return;
    }
  }

  // All airdrop attempts failed. This is not treated as a fatal error as
  // long as the wallet itself exists on disk - devnet faucet rate limiting
  // is expected and routine, and the wallet is still usable once funded
  // manually.
  console.log("Airdrop failed. Use https://faucet.solana.com manually with this public key.");
}

main()
  .then(() => {
    // Success as long as the wallet file exists on disk, even if every
    // airdrop attempt above failed.
    process.exit(existsSync(secretKeyPath) ? 0 : 1);
  })
  .catch((error) => {
    // Only unexpected failures before/outside the airdrop flow (e.g. the
    // wallet file itself could not be created or read) reach here.
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to set up devnet wallet: ${message}`);
    process.exit(1);
  });
