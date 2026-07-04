/**
 * load-env.ts
 *
 * Side-effect module that MUST be imported as the very first line of the API
 * entrypoint. It locates the monorepo root (by walking up until
 * `pnpm-workspace.yaml` is found) and loads the root `.env` into
 * `process.env` via dotenv.
 *
 * Why this exists:
 *   `pnpm --filter @matchpulse/api dev` sets cwd to `apps/api/`, not the
 *   repo root. The root `.env` — which holds TXLINE_GUEST_JWT,
 *   SOLANA_KEYPAIR_PATH, etc. — would otherwise never be loaded.
 *
 * No secrets are logged. Only the resolved env-file path is printed so the
 * operator can confirm the correct file was picked up.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

function findRepoRoot(): string {
  let current = process.cwd();
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(path.join(current, "pnpm-workspace.yaml"))) return current;
    const next = path.dirname(current);
    if (next === current) break;
    current = next;
  }
  // Fallback: assume we are three levels below root (apps/api/src).
  return path.resolve(process.cwd(), "..", "..", "..");
}

const repoRoot = findRepoRoot();
const envPath = path.join(repoRoot, ".env");

if (existsSync(envPath)) {
  dotenv.config({ path: envPath, override: true });
  console.log(`Loaded .env from ${envPath}`);
} else {
  console.warn(`Root .env not found at ${envPath}`);
}

export {};
