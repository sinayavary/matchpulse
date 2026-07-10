import assert from "node:assert/strict";
import test from "node:test";
import { canonicalizeStorageValue, computeStorageContentHash } from "./prediction-storage-hash.js";

// D-1: Same object with different key order has the same canonical form
test("hash-1: same flat object with different key order produces identical canonical form", () => {
  assert.equal(canonicalizeStorageValue({ b: 2, a: 1 }), canonicalizeStorageValue({ a: 1, b: 2 }));
});

// D-2: Same nested object with different key order has the same hash
test("hash-2: same nested object with different key order produces identical hash", () => {
  assert.equal(
    computeStorageContentHash({ outer: { z: 3, a: { d: 4, c: 3 } }, b: 2 }),
    computeStorageContentHash({ b: 2, outer: { a: { c: 3, d: 4 }, z: 3 } }),
  );
});

// D-3: Array order is preserved
test("hash-3: array element order is preserved in canonical form", () => {
  assert.notEqual(canonicalizeStorageValue([1, 2, 3]), canonicalizeStorageValue([3, 2, 1]));
  assert.equal(canonicalizeStorageValue([1, 2, 3]), canonicalizeStorageValue([1, 2, 3]));
});

// D-4: Different arrays produce different hashes
test("hash-4: different arrays produce different hashes", () => {
  assert.notEqual(computeStorageContentHash({ values: [1, 2] }), computeStorageContentHash({ values: [2, 1] }));
  assert.notEqual(computeStorageContentHash({ values: [1] }), computeStorageContentHash({ values: [1, 2] }));
});

// D-5: Different numbers produce different hashes
test("hash-5: different numbers produce different hashes", () => {
  assert.notEqual(computeStorageContentHash({ value: 1 }), computeStorageContentHash({ value: 1.1 }));
  assert.notEqual(computeStorageContentHash({ value: 0 }), computeStorageContentHash({ value: 1 }));
});

// D-6: 0 and -0 behavior is documented and deterministic
test("hash-6: 0 and -0 produce identical hashes (JSON.stringify treats them the same)", () => {
  assert.equal(computeStorageContentHash({ value: 0 }), computeStorageContentHash({ value: -0 }));
  assert.equal(JSON.stringify(0), JSON.stringify(-0)); // documents why
});

// D-7: Undefined root value fails
test("hash-7: undefined root value throws TypeError", () => {
  assert.throws(() => canonicalizeStorageValue(undefined), TypeError);
});

// D-8: Undefined nested property fails
test("hash-8: undefined nested property throws TypeError", () => {
  assert.throws(() => canonicalizeStorageValue({ a: undefined }), TypeError);
});

// D-9: Undefined array element fails
test("hash-9: undefined array element throws TypeError", () => {
  assert.throws(() => canonicalizeStorageValue([1, undefined, 3]), TypeError);
});

// D-10: NaN fails
test("hash-10: NaN throws TypeError", () => {
  assert.throws(() => canonicalizeStorageValue(Number.NaN), TypeError);
  assert.throws(() => canonicalizeStorageValue({ value: Number.NaN }), TypeError);
});

// D-11: Positive Infinity fails
test("hash-11: Positive Infinity throws TypeError", () => {
  assert.throws(() => canonicalizeStorageValue(Number.POSITIVE_INFINITY), TypeError);
});

// D-12: Negative Infinity fails
test("hash-12: Negative Infinity throws TypeError", () => {
  assert.throws(() => canonicalizeStorageValue(Number.NEGATIVE_INFINITY), TypeError);
});

// D-13: BigInt behavior is explicit (rejected)
test("hash-13: BigInt value throws TypeError", () => {
  assert.throws(() => canonicalizeStorageValue(BigInt(42)), TypeError);
  assert.throws(() => canonicalizeStorageValue({ value: BigInt(0) }), TypeError);
});

// D-14: Function values fail
test("hash-14: function value throws TypeError", () => {
  assert.throws(() => canonicalizeStorageValue(() => { }), TypeError);
  assert.throws(() => canonicalizeStorageValue({ fn: () => { } }), TypeError);
});

// D-15: Symbol values fail
test("hash-15: symbol value throws TypeError", () => {
  assert.throws(() => canonicalizeStorageValue(Symbol("test")), TypeError);
  assert.throws(() => canonicalizeStorageValue({ [Symbol("key")]: 1 }), TypeError);
});

// D-16: Cyclic objects fail
test("hash-16: cyclic object throws TypeError", () => {
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  assert.throws(() => canonicalizeStorageValue(cyclic), TypeError);
});

// D-17: Date handling is deterministic
test("hash-17: Date handling is deterministic via ISO string", () => {
  const d1 = new Date("2026-07-10T10:00:00Z");
  const d2 = new Date("2026-07-10T10:00:00.000Z");
  assert.equal(canonicalizeStorageValue(d1), canonicalizeStorageValue(d2));
  const d3 = new Date("2026-07-10T10:00:01Z");
  assert.notEqual(canonicalizeStorageValue(d1), canonicalizeStorageValue(d3));
  assert.throws(() => canonicalizeStorageValue(new Date("invalid")), TypeError);
});

// D-18: Input is not mutated
test("hash-18: input object is not mutated by canonicalization or hashing", () => {
  const value = { nested: { b: 2, a: 1 }, list: ["x", true] };
  const before = structuredClone(value);
  canonicalizeStorageValue(value);
  computeStorageContentHash(value);
  assert.deepEqual(value, before);
});

// D-19: Hash is lowercase hexadecimal
test("hash-19: hash output is lowercase hexadecimal", () => {
  const hash = computeStorageContentHash({ test: true });
  assert.match(hash, /^[0-9a-f]+$/);
  assert.equal(hash, hash.toLowerCase());
});

// D-20: Hash length is 64 (SHA-256)
test("hash-20: hash length is 64 characters (SHA-256)", () => {
  assert.equal(computeStorageContentHash("hello").length, 64);
  assert.equal(computeStorageContentHash({ complex: { nested: [1, 2, 3] } }).length, 64);
  assert.match(computeStorageContentHash(42), /^[0-9a-f]{64}$/);
});
