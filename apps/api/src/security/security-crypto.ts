import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
export const base64url = (value: Uint8Array | Buffer) => Buffer.from(value).toString("base64url");
export const randomSecret = (bytes = 32) => base64url(randomBytes(bytes));
export const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
export const hashSecret = (value: string) => sha256(value);
export const pseudonym = (value: string) => sha256(value).slice(0, 16);
export function verifyEqual(left: string, right: string) { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); }
export function createScryptVerifier(secret: string) { const salt = randomBytes(16); return `${base64url(salt)}.${scryptSync(secret, salt, 32).toString("base64url")}`; }
export function verifyScrypt(secret: string, verifier: string) { const [saltText, hashText] = verifier.split("."); if (!saltText || !hashText) return false; const actual = scryptSync(secret, Buffer.from(saltText, "base64url"), 32); return verifyEqual(actual.toString("base64url"), hashText); }
