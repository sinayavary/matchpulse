import test from "node:test";
import assert from "node:assert/strict";
import { createApiRateLimiter } from "./api-rate-limit.js";
import { redactAuditEvent } from "./security-audit.js";
test("rate limiter fails closed at concurrency bound", () => { const limiter = createApiRateLimiter({ max: 1, maxConcurrent: 1 }); assert.equal(limiter.begin("x"), true); assert.equal(limiter.begin("x"), false); limiter.end("x"); });
test("audit output redacts credential material", () => { const value = redactAuditEvent({ event:"x", success:true, metadata:{ clientSecret:"do-not-store", nested:{ signature:"hidden" } } }); assert.equal((value.metadata as any).clientSecret, "[REDACTED]"); assert.equal((value.metadata as any).nested.signature, "[REDACTED]"); });
