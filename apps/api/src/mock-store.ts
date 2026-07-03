import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createMeta, type ApiResponse } from "@matchpulse/shared";

function findRepoRoot(): string {
  let current = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(path.join(current, "mock-data"))) return current;
    const next = path.dirname(current);
    if (next === current) break;
    current = next;
  }
  return process.cwd();
}

const repoRoot = findRepoRoot();
const mockRoot = path.join(repoRoot, "mock-data");

export function readMock<T>(fileName: string): T {
  const filePath = path.join(mockRoot, fileName);
  const raw = readFileSync(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export function response<T>(data: T, status: "live" | "replay" | "no_data" = "live"): ApiResponse<T> {
  return {
    data,
    meta: createMeta("mock", status === "replay" ? "replay" : "mock", status)
  };
}
