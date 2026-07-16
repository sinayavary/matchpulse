import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const sourcePath = (name: string) => fileURLToPath(new URL(`./${name}`, import.meta.url));

test("public legacy raw route is explicitly unavailable", () => {
  const source = readFileSync(sourcePath("server.ts"), "utf8");
  assert.match(source, /app\.get\("\/api\/matches\/:fixtureId\/raw",[\s\S]*?reply\.code\(404\)/);
  assert.equal(source.includes('readMock("raw-data.json")'), false);
  assert.equal(source.includes("Raw provider payloads are not publicly available."), true);
});

test("Telegram webhook logging contains no request body", () => {
  const source = readFileSync(sourcePath("server.ts"), "utf8");
  const webhookStart = source.indexOf('app.post("/api/telegram/webhook"');
  assert.ok(webhookStart >= 0);
  const webhook = source.slice(webhookStart, webhookStart + 400);
  assert.equal(webhook.includes("request.body"), false);
  assert.equal(webhook.includes("telegram_webhook_received"), true);
});

test("runtime audit HTTP response excludes raw payload collection", () => {
  const source = readFileSync(sourcePath("txline-runtime-audit-routes.ts"), "utf8");
  assert.equal(source.includes("raw_payloads: auditRun.rawPayloads"), false);
  assert.equal(source.includes("audit_run: auditRun"), true);
});
