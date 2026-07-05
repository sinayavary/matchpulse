import "../load-env.js";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  activateApiToken,
  buildActivationMessage,
  loadProjectWalletFromEnv,
  parseSelectedLeagues,
  signActivationMessage,
  TxlineActivationError
} from "@matchpulse/txline-client";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.."
);
const tokenRelativePath = "secrets/txline-api-token.txt";
const tokenPath = path.join(repoRoot, tokenRelativePath);

function readTxSig(): string {
  const prefix = "--txSig=";
  const cliValues = process.argv.slice(2).filter((argument) => argument.startsWith(prefix));
  if (cliValues.length > 1) {
    throw new TxlineActivationError("Provide --txSig only once.");
  }

  const txSig = cliValues[0]?.slice(prefix.length).trim()
    || process.env.TXLINE_ACTIVATION_TX_SIG?.trim();
  if (!txSig) {
    throw new TxlineActivationError(
      "A transaction signature is required via --txSig=<signature> or TXLINE_ACTIVATION_TX_SIG."
    );
  }
  return txSig;
}

function requireGuestJwt(): string {
  const guestJwt = process.env.TXLINE_GUEST_JWT?.trim();
  if (!guestJwt) {
    throw new TxlineActivationError("TXLINE_GUEST_JWT is not configured.");
  }
  return guestJwt;
}

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
  const txSig = readTxSig();
  const guestJwt = requireGuestJwt();
  const selectedLeagues = parseSelectedLeagues(process.env.TXLINE_SELECTED_LEAGUES);
  const wallet = loadProjectWalletFromEnv();

  const message = buildActivationMessage(txSig, selectedLeagues, guestJwt);
  const walletSignature = signActivationMessage(message, wallet);
  const token = await activateApiToken({
    guestJwt,
    txSig,
    walletSignature,
    selectedLeagues
  });

  await saveApiToken(token);

  console.log("activation_status: success");
  console.log("token_received: true");
  console.log(`token_saved_to: ${tokenRelativePath}`);
}

main().catch((error) => {
  console.error("activation_status: failed");
  if (error instanceof TxlineActivationError) {
    if (error.status !== undefined) console.error(`http_status: ${error.status}`);
    if (error.diagnostics.endpointHost) console.error(`endpoint_host: ${error.diagnostics.endpointHost}`);
    if (error.diagnostics.endpointPath) console.error(`endpoint_path: ${error.diagnostics.endpointPath}`);
    if (error.diagnostics.responseContentType) {
      console.error(`response_content_type: ${error.diagnostics.responseContentType}`);
    }
    if (error.diagnostics.responseErrorCode) {
      console.error(`response_error_code: ${error.diagnostics.responseErrorCode}`);
    }
    if (error.diagnostics.responseMessage) {
      console.error(`response_message: ${error.diagnostics.responseMessage}`);
    }
    if (error.diagnostics.responseBodyPreview) {
      console.error(`response_body_preview: ${error.diagnostics.responseBodyPreview}`);
    }
    if (error.diagnostics.errorName) console.error(`error_name: ${error.diagnostics.errorName}`);
    if (error.diagnostics.errorMessage) console.error(`error_message: ${error.diagnostics.errorMessage}`);
    if (error.diagnostics.causeCode) console.error(`cause_code: ${error.diagnostics.causeCode}`);
  } else {
    const errorName = error instanceof Error ? error.name : typeof error;
    console.error(`error_name: ${errorName}`);
    console.error("error_message: Unexpected activation error.");
  }
  console.error("token_received: false");
  console.error("token_saved_to: not_saved");
  process.exitCode = 1;
});
