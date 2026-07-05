import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  activateApiToken,
  buildActivationMessage,
  runActivationPreflight,
  sendSubscribeTransaction,
  signActivationMessage,
  TxlineActivationError
} from "@matchpulse/txline-client";
import "../load-env.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.."
);
const tokenRelativePath = "secrets/txline-api-token.txt";
const tokenPath = path.join(repoRoot, tokenRelativePath);

async function saveApiToken(token: string): Promise<void> {
  if (!token) {
    throw new TxlineActivationError("Activation returned no API token; token file was not created.");
  }

  try {
    await mkdir(path.dirname(tokenPath), { recursive: true });
    await writeFile(tokenPath, token, { encoding: "utf8" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new TxlineActivationError(`API token could not be saved: ${message}`);
  }
}

async function main(): Promise<void> {
  console.log("=== TxLINE Devnet Activation ===");
  const preflight = await runActivationPreflight();
  console.log(`activation_ready: ${preflight.activationReady}`);
  if (!preflight.activationReady) {
    console.error("Activation stopped before transaction. Missing or invalid:");
    for (const item of preflight.invalidItems) console.error(`  - ${item}`);
    process.exitCode = 1;
    return;
  }

  const wallet = preflight.wallet!;
  const program = preflight.program!;
  const guestJwt = process.env.TXLINE_GUEST_JWT!;
  const selectedLeagues = preflight.selectedLeagues!;

  console.log(`wallet_public_key: ${wallet.publicKey.toBase58()}`);
  console.log(`wallet_balance: ${preflight.walletBalanceSol} SOL`);

  const txSig = await sendSubscribeTransaction({
    program,
    wallet,
    serviceLevelId: preflight.serviceLevelId!,
    durationWeeks: preflight.durationWeeks!
  });
  console.log(`txSig: ${txSig}`);

  const message = buildActivationMessage(txSig, selectedLeagues, guestJwt);
  const walletSignature = signActivationMessage(message, wallet);
  let activationHttpStatus: number | null = null;
  const token = await activateApiToken({
    guestJwt,
    txSig,
    walletSignature,
    selectedLeagues,
    onResponseStatus: (status) => {
      activationHttpStatus = status;
    }
  });

  await saveApiToken(token);

  console.log(`activation_http_status: ${activationHttpStatus}`);
  console.log("activation_status: success");
  console.log("token_received: true");
  console.log(`token_saved_to: ${tokenRelativePath}`);
}

main().catch((error) => {
  if (error instanceof TxlineActivationError && error.status) {
    console.error(`activation_http_status: ${error.status}`);
  }
  const message = error instanceof Error ? error.message : String(error);
  console.error(`activation_status: failed (${message})`);
  process.exitCode = 1;
});
