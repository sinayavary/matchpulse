import { createHash } from "node:crypto";

function canonicalize(value: unknown, seen: Set<object>): string {
  if (value === null) return "null";

  if (value instanceof Date) {
    const time = value.getTime();
    if (!Number.isFinite(time)) throw new TypeError("Invalid Date is not supported.");
    return JSON.stringify(value.toISOString());
  }

  switch (typeof value) {
    case "string":
    case "boolean":
      return JSON.stringify(value);
    case "number":
      if (!Number.isFinite(value)) throw new TypeError("Only finite numbers are supported.");
      return JSON.stringify(value);
    case "undefined":
      throw new TypeError("undefined is not supported in storage values.");
    case "function":
      throw new TypeError("functions are not supported in storage values.");
    case "symbol":
      throw new TypeError("symbols are not supported in storage values.");
    case "bigint":
      throw new TypeError("bigint is not supported in storage values.");
    case "object":
      if (seen.has(value)) throw new TypeError("Cyclic storage values are not supported.");
      seen.add(value);
      try {
      if (Array.isArray(value)) {
          return `[${value.map((item) => canonicalize(item, seen)).join(",")}]`;
        }
        if (Reflect.ownKeys(value).some((key) => typeof key === "symbol")) {
          throw new TypeError("symbol keys are not supported in storage values.");
        }
        const entries = Object.keys(value)
          .sort()
          .map((key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key], seen)}`);
        return `{${entries.join(",")}}`;
      } finally {
        seen.delete(value);
      }
    default:
      throw new TypeError("Unsupported storage value.");
  }
}

export function canonicalizeStorageValue(value: unknown): string {
  return canonicalize(value, new Set<object>());
}

export function computeStorageContentHash(value: unknown): string {
  return createHash("sha256")
    .update(canonicalizeStorageValue(value), "utf8")
    .digest("hex");
}
