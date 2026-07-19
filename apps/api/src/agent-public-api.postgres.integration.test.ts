import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import Fastify from "fastify";
import { PrismaClient } from "@prisma/client";
import { registerPublicApiRoutes } from "./public-api.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL required");
const parsed = new URL(url);
if (!["127.0.0.1", "localhost", "::1"].includes(parsed.hostname) || !/^matchpulse_agent_api_/.test(decodeURIComponent(parsed.pathname.slice(1)))) throw new Error("disposable loopback database required");
const db = new PrismaClient();
const fixtureId = `agent-api-smoke-${Date.now()}`;
const now = new Date();
let app: ReturnType<typeof Fastify>;
let oldAnonymous: string | undefined;

before(async () => {
  oldAnonymous = process.env.MATCHPULSE_PUBLIC_READ_ANONYMOUS;
  process.env.MATCHPULSE_PUBLIC_READ_ANONYMOUS = "true";
  await db.fixture.create({ data: { fixtureId, competition: "Smoke Competition", sport: "soccer", homeTeam: "Smoke Home", awayTeam: "Smoke Away", status: "1H", startTimeUtc: new Date(now.getTime() - 30 * 60_000) } });
  await db.matchState.create({ data: { fixtureId, minute: 30, phase: "1H", homeScore: 1, awayScore: 0, inRunning: true, marketMood: "stable", momentumSide: "home", momentumScore: 0.6, lastDataReceivedAt: now } });
  await db.oddsSnapshot.createMany({ data: ["home", "draw", "away"].map((selectionName, index) => ({ fixtureId, externalSeq: `smoke-${index}`, marketId: "match_winner|period:0", marketName: "Match Winner", selectionName, odds: [2.1, 3.2, 3.6][index]!, direction: "stable", sourceTimestamp: now })) });
  app = Fastify({ logger: false }); registerPublicApiRoutes(app); await app.ready();
});

test("public Agent endpoints serve persisted smoke fixture", async () => {
  const card = await app.inject({ method: "GET", url: `/api/public/matches/${fixtureId}/intelligence-card` });
  assert.equal(card.statusCode, 200); const cardBody = card.json(); assert.equal(cardBody.data.fixture_id, fixtureId); assert.ok(cardBody.data.brief); assert.ok(cardBody.data.signal_summary); assert.equal(cardBody.meta.mode, "public");
  const product = await app.inject({ method: "GET", url: `/api/public/matches/${fixtureId}/product-intelligence` });
  assert.equal(product.statusCode, 200); const productBody = product.json(); assert.ok(productBody.data); assert.equal(productBody.data.fixture_id, fixtureId); assert.equal(productBody.data.product_version, "matchpulse-final-v1"); assert.equal(productBody.meta.mode, "public");
});

after(async () => { await app?.close(); await db.fixture.deleteMany({ where: { fixtureId } }); await db.$disconnect(); if (oldAnonymous === undefined) delete process.env.MATCHPULSE_PUBLIC_READ_ANONYMOUS; else process.env.MATCHPULSE_PUBLIC_READ_ANONYMOUS = oldAnonymous; });
