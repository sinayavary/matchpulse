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

// Mock fixture files on disk are already stored as full { data, meta }
// envelopes (matching API_CONTRACT.md so they're easy to hand-edit and
// inspect standalone). readMock() unwraps that envelope and hands callers
// just the payload, so response() below can build a single, non-nested
// envelope instead of wrapping an already-wrapped object.
export function readMock<T>(fileName: string): T {
  const filePath = path.join(mockRoot, fileName);
  const raw = readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (parsed && typeof parsed === "object" && "data" in (parsed as Record<string, unknown>)) {
    return (parsed as { data: T }).data;
  }
  return parsed as T;
}

export function response<T>(data: T, status: "live" | "replay" | "no_data" = "live"): ApiResponse<T> {
  return {
    data,
    meta: createMeta("mock", status === "replay" ? "replay" : "mock", status)
  };
}

export function notFoundResponse(message: string): ApiResponse<null> {
  return {
    data: null,
    meta: {
      ...createMeta("mock", "mock", "error"),
      message
    }
  };
}
