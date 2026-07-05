import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync
} from "@solana/spl-token";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import axios, { type AxiosResponse } from "axios";
import nacl from "tweetnacl";
import TxoracleJson from "./idl/txoracle.json" with { type: "json" };
import type { Txoracle } from "./types/txoracle.js";

const REQUIRED_ACCOUNTS = [
  "user", "pricing_matrix", "token_mint", "user_token_account",
  "token_treasury_vault", "token_treasury_pda", "token_program",
  "system_program", "associated_token_program"
] as const;

export type TxlineActivationDiagnostics = {
  endpointHost?: string;
  endpointPath?: string;
  responseContentType?: string;
  responseErrorCode?: string;
  responseMessage?: string;
  responseBodyPreview?: string;
  errorName?: string;
  errorMessage?: string;
  causeCode?: string;
};

export class TxlineActivationError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly diagnostics: TxlineActivationDiagnostics = {}
  ) {
    super(message);
    this.name = "TxlineActivationError";
  }
}

const MAX_DIAGNOSTIC_LENGTH = 500;
const SENSITIVE_RESPONSE_KEY = /(?:authorization|api.?token|token|jwt|signature|secret|private.?key|wallet)/i;

function truncateDiagnostic(value: string): string {
  return value.length <= MAX_DIAGNOSTIC_LENGTH
    ? value
    : `${value.slice(0, MAX_DIAGNOSTIC_LENGTH - 3)}...`;
}

function sanitizeDiagnosticText(value: string, secrets: string[] = []): string {
  let sanitized = value;
  for (const secret of secrets) {
    if (secret) sanitized = sanitized.split(secret).join("[REDACTED]");
  }
  sanitized = sanitized
    .replace(/Bearer\s+[^\s"'<>]+/gi, "Bearer [REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED_JWT]")
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/gi, "[REDACTED_PRIVATE_KEY]")
    .replace(/\[(?:\s*\d+\s*,){31,}\s*\d+\s*\]/g, "[REDACTED_KEY_ARRAY]")
    .replace(/\b(?:sk|api)[-_][A-Za-z0-9_-]{16,}\b/gi, "[REDACTED_API_TOKEN]")
    .replace(
      /(["']?(?:authorization|api.?token|token|jwt|signature|secret|private.?key|walletSignature)["']?\s*[:=]\s*["']?)([^\s,"'<>}]+)/gi,
      "$1[REDACTED]"
    );
  return truncateDiagnostic(sanitized.replace(/\s+/g, " ").trim());
}

function sanitizeJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeJsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_RESPONSE_KEY.test(key) ? "[REDACTED]" : sanitizeJsonValue(item)
      ])
    );
  }
  return value;
}

function diagnosticScalar(value: unknown, secrets: string[]): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const sanitized = sanitizeDiagnosticText(String(value), secrets);
  return sanitized || undefined;
}

function responseJsonFields(body: unknown, secrets: string[]): {
  errorCode?: string;
  message?: string;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  const record = body as Record<string, unknown>;
  const nestedError = record.error && typeof record.error === "object" && !Array.isArray(record.error)
    ? record.error as Record<string, unknown>
    : undefined;
  return {
    errorCode: diagnosticScalar(
      record.error_code ?? record.errorCode ?? record.code ?? nestedError?.code,
      secrets
    ),
    message: diagnosticScalar(record.message ?? nestedError?.message ?? record.error, secrets)
  };
}

function errorCauseCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const cause = "cause" in error ? (error as { cause?: unknown }).cause : undefined;
  if (!cause || typeof cause !== "object" || !("code" in cause)) return undefined;
  const code = (cause as { code?: unknown }).code;
  return typeof code === "string" || typeof code === "number"
    ? sanitizeDiagnosticText(String(code))
    : undefined;
}

function requireEnv(name: string, env: NodeJS.ProcessEnv = process.env): string {
  const value = env[name]?.trim();
  if (!value) throw new TxlineActivationError(`${name} is not configured.`);
  return value;
}

function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
}

export function resolveProjectWalletPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.resolve(repoRoot(), requireEnv("SOLANA_KEYPAIR_PATH", env));
}

export function loadProjectWalletFromEnv(env: NodeJS.ProcessEnv = process.env): Keypair {
  const walletPath = resolveProjectWalletPath(env);
  if (!existsSync(walletPath)) {
    throw new TxlineActivationError("SOLANA_KEYPAIR_PATH does not point to an existing file.");
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(walletPath, "utf8"));
    if (!Array.isArray(parsed) || !parsed.every(Number.isInteger)) throw new Error("invalid keypair");
    return Keypair.fromSecretKey(Uint8Array.from(parsed as number[]));
  } catch {
    throw new TxlineActivationError("The configured project wallet could not be loaded.");
  }
}

export type TxlineAnchorProgram = Program<Txoracle>;

export function createTxlineAnchorProgram(
  wallet: Keypair = loadProjectWalletFromEnv(),
  env: NodeJS.ProcessEnv = process.env
): TxlineAnchorProgram {
  const connection = new Connection(requireEnv("TXLINE_RPC_URL", env), "confirmed");
  const programId = new PublicKey(requireEnv("TXLINE_PROGRAM_ID", env));
  const provider = new AnchorProvider(connection, new Wallet(wallet), {
    commitment: "confirmed",
    preflightCommitment: "confirmed"
  });
  const idl = { ...TxoracleJson, address: programId.toBase58() } as unknown as Txoracle;
  return new Program<Txoracle>(idl, provider);
}

export type TxlineSubscribeAccounts = {
  user: PublicKey;
  pricingMatrix: PublicKey;
  tokenMint: PublicKey;
  userTokenAccount: PublicKey;
  tokenTreasuryVault: PublicKey;
  tokenTreasuryPda: PublicKey;
  tokenProgram: PublicKey;
  systemProgram: PublicKey;
  associatedTokenProgram: PublicKey;
};

export function deriveTxlineSubscribeAccounts(params: {
  program: TxlineAnchorProgram;
  wallet: Keypair;
  tokenMint?: PublicKey;
  env?: NodeJS.ProcessEnv;
}): TxlineSubscribeAccounts {
  const tokenMint = params.tokenMint ?? new PublicKey(requireEnv("TXLINE_TXL_TOKEN_MINT", params.env));
  const [pricingMatrix] = PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")], params.program.programId
  );
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_treasury_v2")], params.program.programId
  );
  return {
    user: params.wallet.publicKey,
    pricingMatrix,
    tokenMint,
    userTokenAccount: getAssociatedTokenAddressSync(
      tokenMint, params.wallet.publicKey, false, TOKEN_2022_PROGRAM_ID
    ),
    tokenTreasuryVault: getAssociatedTokenAddressSync(
      tokenMint, tokenTreasuryPda, true, TOKEN_2022_PROGRAM_ID
    ),
    tokenTreasuryPda,
    tokenProgram: TOKEN_2022_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
  };
}

function validateSubscription(serviceLevelId: number, durationWeeks: number): void {
  if (!Number.isInteger(serviceLevelId) || serviceLevelId < 0 || serviceLevelId > 65_535) {
    throw new TxlineActivationError("TXLINE_SERVICE_LEVEL_ID must be a valid u16.");
  }
  if (!Number.isInteger(durationWeeks) || durationWeeks < 4 || durationWeeks % 4 !== 0 || durationWeeks > 255) {
    throw new TxlineActivationError(
      "TXLINE_DURATION_WEEKS must be a valid u8 that is at least 4 and divisible by 4."
    );
  }
}

export async function buildSubscribeTransaction(params: {
  program: TxlineAnchorProgram;
  wallet: Keypair;
  serviceLevelId: number;
  durationWeeks: number;
  tokenMint?: PublicKey;
  env?: NodeJS.ProcessEnv;
}): Promise<Transaction> {
  validateSubscription(params.serviceLevelId, params.durationWeeks);
  const accounts = deriveTxlineSubscribeAccounts(params);
  const subscribeTransaction = await params.program.methods
    .subscribe(params.serviceLevelId, params.durationWeeks)
    .accounts(accounts)
    .transaction();
  const userTokenAccountInfo = await params.program.provider.connection.getAccountInfo(
    accounts.userTokenAccount,
    "confirmed"
  );

  if (userTokenAccountInfo) return subscribeTransaction;

  return new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(
      params.wallet.publicKey,
      accounts.userTokenAccount,
      params.wallet.publicKey,
      accounts.tokenMint,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    ),
    ...subscribeTransaction.instructions
  );
}

export async function sendSubscribeTransaction(params: {
  program: TxlineAnchorProgram;
  wallet: Keypair;
  serviceLevelId: number;
  durationWeeks: number;
  tokenMint?: PublicKey;
  env?: NodeJS.ProcessEnv;
}): Promise<string> {
  const transaction = await buildSubscribeTransaction(params);
  const connection = params.program.provider.connection;
  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = latestBlockhash.blockhash;
  transaction.feePayer = params.wallet.publicKey;
  transaction.sign(params.wallet);
  const txSig = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed"
  });
  const confirmation = await connection.confirmTransaction(
    { signature: txSig, ...latestBlockhash }, "confirmed"
  );
  if (confirmation.value.err) {
    throw new TxlineActivationError(`Subscribe transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  }
  return txSig;
}

export function buildActivationMessage(
  txSig: string,
  selectedLeagues: number[],
  guestJwt: string
): string {
  return `${txSig}:${selectedLeagues.join(",")}:${guestJwt}`;
}

export function signActivationMessage(message: string, wallet: Keypair): string {
  const signature = nacl.sign.detached(new TextEncoder().encode(message), wallet.secretKey);
  return Buffer.from(signature).toString("base64");
}

export async function activateApiToken(params: {
  apiBaseUrl?: string;
  guestJwt: string;
  txSig: string;
  walletSignature: string;
  selectedLeagues: number[];
  onResponseStatus?: (status: number) => void;
  env?: NodeJS.ProcessEnv;
}): Promise<string> {
  const apiBaseUrl = (params.apiBaseUrl ?? requireEnv("TXLINE_API_BASE_URL", params.env)).replace(/\/$/, "");
  const endpoint = new URL(`${apiBaseUrl}/token/activate`);
  const endpointDiagnostics = {
    endpointHost: endpoint.host,
    endpointPath: endpoint.pathname
  };
  let response: AxiosResponse<unknown>;
  try {
    response = await axios.post(
      endpoint.toString(),
      {
        txSig: params.txSig,
        walletSignature: params.walletSignature,
        leagues: params.selectedLeagues
      },
      {
        headers: {
          Authorization: `Bearer ${params.guestJwt}`
        },
        validateStatus: () => true
      }
    );
  } catch (error) {
    const errorName = error instanceof Error ? error.name : typeof error;
    const message = sanitizeDiagnosticText(error instanceof Error ? error.message : String(error), [
      params.guestJwt,
      params.walletSignature
    ]);
    throw new TxlineActivationError("Activation request failed.", undefined, {
      ...endpointDiagnostics,
      errorName: sanitizeDiagnosticText(errorName),
      errorMessage: message,
      causeCode: errorCauseCode(error)
    });
  }
  params.onResponseStatus?.(response.status);
  if (response.status < 200 || response.status >= 300) {
    const contentType = sanitizeDiagnosticText(String(response.headers["content-type"] ?? "unknown"));
    const responseBody: unknown = response.data;
    const secrets = [params.guestJwt, params.walletSignature];
    const jsonFields = responseJsonFields(responseBody, secrets);
    const previewSource = typeof responseBody === "string"
      ? responseBody
      : responseBody === undefined
        ? ""
        : JSON.stringify(sanitizeJsonValue(responseBody));
    throw new TxlineActivationError(`Activation request returned HTTP ${response.status}.`, response.status, {
      ...endpointDiagnostics,
      responseContentType: contentType,
      responseErrorCode: jsonFields.errorCode,
      responseMessage: jsonFields.message,
      responseBodyPreview: previewSource
        ? sanitizeDiagnosticText(previewSource, secrets)
        : undefined
    });
  }
  const body: unknown = response.data;
  const token = body && typeof body === "object" && "token" in body
    ? (body as { token?: unknown }).token
    : body;
  if (typeof token !== "string" || token.length === 0) {
    throw new TxlineActivationError("Activation response did not contain a token.", response.status);
  }
  return token;
}

export function parseSelectedLeagues(value: string | undefined): number[] {
  const raw = value?.trim() ?? "";
  if (!raw) return [];
  const leagues = raw.split(",").map((item) => Number(item.trim()));
  if (leagues.some((item) => !Number.isInteger(item))) {
    throw new TxlineActivationError("TXLINE_SELECTED_LEAGUES must be a comma-separated number array.");
  }
  return leagues;
}

export type ActivationPreflightResult = {
  activationReady: boolean;
  invalidItems: string[];
  rpcConnected: boolean;
  walletFileExists: boolean;
  walletPublicKey: string | null;
  walletBalanceSol: number | null;
  guestJwtConfigured: boolean;
  apiTokenConfigured: boolean;
  apiBaseConfigured: boolean;
  serviceLevelConfigured: boolean;
  durationWeeksConfigured: boolean;
  programIdValid: boolean;
  tokenMintValid: boolean;
  idlLoaded: boolean;
  subscribeInstructionImplemented: boolean;
  subscribeAccountsValid: boolean;
  derivationSucceeded: boolean;
  userTokenAccountAddress: string | null;
  userTokenAccountInitialized: boolean;
  userTokenAccountWillBeCreated: boolean;
  activationEndpointValid: boolean;
  selectedLeagues: number[] | null;
  wallet: Keypair | null;
  program: TxlineAnchorProgram | null;
  serviceLevelId: number | null;
  durationWeeks: number | null;
};

export async function runActivationPreflight(
  env: NodeJS.ProcessEnv = process.env
): Promise<ActivationPreflightResult> {
  const invalidItems: string[] = [];
  const present = (name: string) => Boolean(env[name]?.trim());
  const guestJwtConfigured = present("TXLINE_GUEST_JWT");
  const apiTokenConfigured = present("TXLINE_API_TOKEN");
  const apiBaseConfigured = present("TXLINE_API_BASE_URL");
  const serviceLevelConfigured = present("TXLINE_SERVICE_LEVEL_ID");
  const durationWeeksConfigured = present("TXLINE_DURATION_WEEKS");
  if (!guestJwtConfigured) invalidItems.push("TXLINE_GUEST_JWT (missing)");
  if (!apiBaseConfigured) invalidItems.push("TXLINE_API_BASE_URL (missing)");
  if (!serviceLevelConfigured) invalidItems.push("TXLINE_SERVICE_LEVEL_ID (missing)");
  if (!durationWeeksConfigured) invalidItems.push("TXLINE_DURATION_WEEKS (missing)");

  const serviceLevelId = serviceLevelConfigured ? Number(env.TXLINE_SERVICE_LEVEL_ID) : null;
  if (serviceLevelId !== null && (!Number.isInteger(serviceLevelId) || serviceLevelId < 0 || serviceLevelId > 65_535)) {
    invalidItems.push("TXLINE_SERVICE_LEVEL_ID (must be a valid u16)");
  }
  const durationWeeks = durationWeeksConfigured ? Number(env.TXLINE_DURATION_WEEKS) : null;
  if (durationWeeks !== null && (!Number.isInteger(durationWeeks) || durationWeeks < 4)) {
    invalidItems.push("TXLINE_DURATION_WEEKS (must be an integer >= 4)");
  }
  if (durationWeeks !== null && Number.isInteger(durationWeeks) && durationWeeks % 4 !== 0) {
    invalidItems.push("TXLINE_DURATION_WEEKS (must be divisible by 4)");
  }
  if (durationWeeks !== null && durationWeeks > 255) {
    invalidItems.push("TXLINE_DURATION_WEEKS (must fit IDL u8)");
  }

  let programIdValid = false;
  let tokenMintValid = false;
  try { new PublicKey(requireEnv("TXLINE_PROGRAM_ID", env)); programIdValid = true; }
  catch { invalidItems.push("TXLINE_PROGRAM_ID (missing or invalid)"); }
  try { new PublicKey(requireEnv("TXLINE_TXL_TOKEN_MINT", env)); tokenMintValid = true; }
  catch { invalidItems.push("TXLINE_TXL_TOKEN_MINT (missing or invalid)"); }

  const idl = TxoracleJson as { instructions?: Array<{ name?: string; accounts?: Array<{ name?: string }> }> };
  const idlLoaded = Array.isArray(idl.instructions);
  const subscribe = idl.instructions?.find((instruction) => instruction.name === "subscribe");
  const subscribeInstructionImplemented = Boolean(subscribe);
  const idlAccounts = new Set(subscribe?.accounts?.map((account) => account.name));
  const subscribeAccountsValid = REQUIRED_ACCOUNTS.every((name) => idlAccounts.has(name));
  if (!idlLoaded) invalidItems.push("official IDL (could not load)");
  if (!subscribeInstructionImplemented) invalidItems.push("official IDL subscribe instruction (missing)");
  if (!subscribeAccountsValid) invalidItems.push("official IDL subscribe accounts (missing or invalid)");

  let selectedLeagues: number[] | null = null;
  try { selectedLeagues = parseSelectedLeagues(env.TXLINE_SELECTED_LEAGUES); }
  catch { invalidItems.push("TXLINE_SELECTED_LEAGUES (must parse as number[])"); }

  let activationEndpointValid = false;
  if (apiBaseConfigured) {
    try {
      const endpoint = new URL(`${env.TXLINE_API_BASE_URL!.replace(/\/$/, "")}/token/activate`);
      activationEndpointValid = endpoint.protocol === "https:" || endpoint.protocol === "http:";
    } catch { /* reported below */ }
  }
  if (!activationEndpointValid) invalidItems.push("activation endpoint (cannot be constructed)");

  let walletFileExists = false;
  try { walletFileExists = existsSync(resolveProjectWalletPath(env)); }
  catch { /* reported below */ }
  if (!walletFileExists) invalidItems.push("SOLANA_KEYPAIR_PATH (wallet file not found)");
  let wallet: Keypair | null = null;
  if (walletFileExists) {
    try { wallet = loadProjectWalletFromEnv(env); }
    catch { invalidItems.push("SOLANA_KEYPAIR_PATH (wallet public key could not be loaded)"); }
  }

  let rpcConnected = false;
  let walletBalanceSol: number | null = null;
  let program: TxlineAnchorProgram | null = null;
  let connection: Connection | null = null;
  if (!present("TXLINE_RPC_URL")) {
    invalidItems.push("TXLINE_RPC_URL (missing)");
  } else {
    try {
      connection = new Connection(env.TXLINE_RPC_URL!, "confirmed");
      if (wallet) {
        walletBalanceSol = (await connection.getBalance(wallet.publicKey, "confirmed")) / LAMPORTS_PER_SOL;
      } else {
        await connection.getSlot("confirmed");
      }
      rpcConnected = true;
    } catch { invalidItems.push("TXLINE_RPC_URL (RPC unreachable)"); }
  }
  if (walletBalanceSol !== null && walletBalanceSol < 0.1) {
    invalidItems.push("wallet balance (must be >= 0.1 SOL)");
  }

  let derivationSucceeded = false;
  let userTokenAccountAddress: string | null = null;
  let userTokenAccountInitialized = false;
  let userTokenAccountWillBeCreated = false;
  if (wallet && programIdValid && tokenMintValid && present("TXLINE_RPC_URL")) {
    try {
      program = createTxlineAnchorProgram(wallet, env);
      const accounts = deriveTxlineSubscribeAccounts({ program, wallet, env });
      userTokenAccountAddress = accounts.userTokenAccount.toBase58();
      if (rpcConnected && connection) {
        userTokenAccountInitialized = Boolean(
          await connection.getAccountInfo(accounts.userTokenAccount, "confirmed")
        );
        userTokenAccountWillBeCreated = !userTokenAccountInitialized;
      }
      derivationSucceeded = true;
    } catch { invalidItems.push("PDA/ATA derivation (failed)"); }
  } else {
    invalidItems.push("PDA/ATA derivation (blocked by invalid configuration)");
  }

  return {
    activationReady: invalidItems.length === 0,
    invalidItems,
    rpcConnected,
    walletFileExists,
    walletPublicKey: wallet?.publicKey.toBase58() ?? null,
    walletBalanceSol,
    guestJwtConfigured,
    apiTokenConfigured,
    apiBaseConfigured,
    serviceLevelConfigured,
    durationWeeksConfigured,
    programIdValid,
    tokenMintValid,
    idlLoaded,
    subscribeInstructionImplemented,
    subscribeAccountsValid,
    derivationSucceeded,
    userTokenAccountAddress,
    userTokenAccountInitialized,
    userTokenAccountWillBeCreated,
    activationEndpointValid,
    selectedLeagues,
    wallet,
    program,
    serviceLevelId,
    durationWeeks
  };
}
