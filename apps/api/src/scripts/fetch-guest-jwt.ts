/**
 * fetch-guest-jwt.ts
 *
 * One-shot CLI script that calls the TxLINE guest auth endpoint and prints
 * only a success/failure message plus a sanitized JWT preview (first 8 chars).
 *
 * The JWT is NOT saved anywhere — the user must manually copy the full token
 * into .env as TXLINE_GUEST_JWT.
 *
 * Usage (from apps/api):
 *   pnpm txline:guest-jwt
 *
 * Security:
 *   - Full JWT is never logged.
 *   - Preview is capped at 8 characters + "...".
 *   - Error messages never echo response bodies that may contain tokens.
 */
import "dotenv/config";
import { fetchGuestJwt, sanitizeJwt, TxlineAuthError } from "@matchpulse/txline-client";

async function main(): Promise<void> {
  console.log("Fetching TxLINE guest JWT...\n");

  try {
    const jwt = await fetchGuestJwt();
    const preview = sanitizeJwt(jwt);

    console.log("Success!");
    console.log(`JWT preview: ${preview}`);
    console.log(
      "\nNext step: copy the full JWT into your .env as TXLINE_GUEST_JWT"
    );
    console.log(
      "(This script does not save it automatically — copy-paste the value from your notes or the raw response.)"
    );
  } catch (error) {
    if (error instanceof TxlineAuthError) {
      console.error(`Failed: ${error.message}`);
      if (error.status !== undefined) {
        console.error(`HTTP status: ${error.status}`);
      }
    } else {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Unexpected error: ${message}`);
    }
    process.exit(1);
  }
}

main();
