import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeTxlineOddsPayload,
  analyzeTxlineScoresPayload,
  calculateLatencyMs,
  extractBestProviderTimestamp,
  hashTxlinePayload,
  runTxlineRuntimeAudit,
  stableSerializeTxlinePayload,
  type TxlineRuntimeAuditInput
} from "./txline-runtime-audit.js";
import { TxlineLiveError } from "@matchpulse/txline-client";

function createInMemoryAuditStore() {
  let runId = 0;
  let payloadId = 0;
  let findingId = 0;
  const runs = new Map<string, Record<string, unknown>>();

  return {
    createAuditRun: async (input: Record<string, unknown>) => {
      const id = `run-${++runId}`;
      const record = {
        id,
        status: String(input.status ?? "running"),
        createdAt: new Date("2026-07-09T10:00:00.000Z"),
        startedAt: input.startedAt ?? null,
        finishedAt: input.finishedAt ?? null,
        fixtureIds: input.fixtureIds,
        competitionIds: input.competitionIds,
        notes: input.notes ?? null,
        summaryJson: input.summaryJson ?? null,
        errorJson: input.errorJson ?? null
      };
      runs.set(id, record);
      return record as any;
    },
    finalizeAuditRun: async (input: Record<string, unknown>) => {
      const existing = runs.get(input.auditRunId as string);
      if (existing === undefined) {
        throw new Error("missing audit run");
      }
      const record = {
        ...existing,
        status: input.status,
        finishedAt: input.finishedAt,
        summaryJson: input.summaryJson ?? null,
        errorJson: input.errorJson ?? null
      };
      runs.set(input.auditRunId as string, record);
      return record as any;
    },
    createAuditFinding: async (input: Record<string, unknown>) => ({
      id: `finding-${++findingId}`,
      createdAt: new Date("2026-07-09T10:00:00.000Z"),
      ...input
    } as any),
    storeRawPayload: async (input: Record<string, unknown>) => ({
      id: `payload-${++payloadId}`,
      ...input
    } as any)
  };
}

const defaultFixturePayload = [
  {
    FixtureId: "17952170",
    CompetitionId: 430,
    Participant1: "Alpha",
    Participant2: "Beta",
    StartTime: 1781226000000,
    Ts: 1781226000000
  }
];

const defaultAuditInput = {
  fixtureIds: ["17952170"],
  competitionId: 430,
  startEpochDay: 20608,
  includeFixtures: true,
  includeScores: true,
  includeOdds: true,
  asOf: 1781226000000,
  notes: "test"
} satisfies TxlineRuntimeAuditInput;

async function runAuditWithPayloads(options: {
  fixturePayload?: unknown;
  scorePayload?: unknown;
  oddsPayload?: unknown;
  input?: Partial<TxlineRuntimeAuditInput>;
} = {}) {
  return runTxlineRuntimeAudit(
    {
      ...defaultAuditInput,
      ...(options.input ?? {})
    },
    {
      now: () => new Date("2026-07-09T10:00:00.000Z"),
      store: createInMemoryAuditStore(),
      fetch: {
        fetchFixtures: async () => options.fixturePayload ?? defaultFixturePayload,
        fetchScores: async () => options.scorePayload ?? [],
        fetchOdds: async () => options.oddsPayload ?? []
      }
    }
  );
}

test("stable payload hashing ignores object key order", () => {
  const first = hashTxlinePayload({
    odds: [{ BookmakerId: 7, Pct: [40, 30, 30] }],
    nested: { b: 2, a: 1 }
  });
  const second = hashTxlinePayload({
    nested: { a: 1, b: 2 },
    odds: [{ Pct: [40, 30, 30], BookmakerId: 7 }]
  });

  assert.equal(first, second);
  assert.equal(stableSerializeTxlinePayload({ b: 1, a: 2 }), stableSerializeTxlinePayload({ a: 2, b: 1 }));
});

test("analyzes PascalCase odds payloads", () => {
  const payload = [
    {
      BookmakerId: 12,
      Bookmaker: "Alpha",
      SuperOddsType: "MATCH_WINNER",
      MarketPeriod: "FULL_TIME",
      MarketParameters: { line: "main" },
      PriceNames: ["Home", "Draw", "Away"],
      Prices: [2.1, 3.2, 2.8],
      Pct: [40, 30, 30],
      Ts: 1781226000000
    }
  ];

  const result = analyzeTxlineOddsPayload(payload, {
    fixtureId: "17952170",
    receivedAt: new Date(1781226005000)
  });

  assert.equal(result.audit.payloadsFetched, 1);
  assert.deepEqual(result.audit.bookmakerIds, ["12"]);
  assert.deepEqual(result.audit.bookmakerNames, ["Alpha"]);
  assert.equal(result.audit.bookmakerCount, 1);
  assert.equal(result.audit.marketCount, 1);
  assert.equal(result.audit.classification, "single_source");
  assert.equal(result.audit.pct.numericCount, 3);
  assert.equal(result.audit.pct.naCount, 0);
  assert.equal(result.audit.pct.pctSumAvg, 100);
  assert.equal(result.latencyMs, 5000);
});

test("analyzes camelCase odds payloads and pct NA handling", () => {
  const payload = [
    {
      bookmakerId: 12,
      bookmaker: "Alpha",
      superOddsType: "MATCH_WINNER",
      marketPeriod: "FULL_TIME",
      marketParameters: { line: "main" },
      priceNames: ["Home", "Draw", "Away"],
      prices: [2.1, 3.2, 2.8],
      pct: [40, "NA", 20],
      ts: 1781226000000
    },
    {
      bookmakerId: 17,
      bookmaker: "Beta",
      superOddsType: "MATCH_WINNER",
      marketPeriod: "FULL_TIME",
      marketParameters: { line: "alt" },
      priceNames: ["Home", "Draw", "Away"],
      prices: [2.0, 3.0, 3.0],
      pct: [25, 25, 50],
      ts: 1781226005000
    }
  ];

  const result = analyzeTxlineOddsPayload(payload, {
    fixtureId: "17588223",
    receivedAt: new Date(1781226010000)
  });

  assert.equal(result.audit.payloadsFetched, 2);
  assert.deepEqual(result.audit.bookmakerIds, ["12", "17"]);
  assert.equal(result.audit.classification, "multi_bookmaker");
  assert.equal(result.audit.pct.numericCount, 5);
  assert.equal(result.audit.pct.naCount, 1);
  assert.equal(result.audit.pct.naRate, 1 / 6);
  assert.equal(result.audit.pct.pctSumMin, 100);
  assert.equal(result.audit.pct.pctSumMax, 100);
  assert.equal(result.audit.pct.pctSumAvg, 100);
});

test("classifies a single TXLineStablePriceDemargined bookmaker as single_stable_price_demargined", () => {
  const payload = [
    {
      BookmakerId: 10021,
      Bookmaker: "TXLineStablePriceDemargined",
      SuperOddsType: "MATCH_WINNER",
      MarketPeriod: "FULL_TIME",
      MarketParameters: { line: "main" },
      Pct: [50, 50],
      Ts: 1781226000000
    }
  ];

  const result = analyzeTxlineOddsPayload(payload, {
    fixtureId: "17588223",
    receivedAt: new Date(1781226005000)
  });

  assert.equal(result.audit.classification, "single_stable_price_demargined");
});

test("classifies mixed bookmaker ids as multi_bookmaker", () => {
  const payload = [
    {
      BookmakerId: 10021,
      Bookmaker: "TXLineStablePriceDemargined",
      Pct: [50, 50],
      Ts: 1781226000000
    },
    {
      BookmakerId: 10022,
      Bookmaker: "AnotherBookmaker",
      Pct: [55, 45],
      Ts: 1781226000000
    }
  ];

  const result = analyzeTxlineOddsPayload(payload, {
    fixtureId: "17588223",
    receivedAt: new Date(1781226005000)
  });

  assert.equal(result.audit.classification, "multi_bookmaker");
});

test("extracts score possessionType and PossibleEvent fields", () => {
  const payload = [
    {
      Seq: 9,
      Ts: 1781226000000,
      FixtureId: 17952170,
      StatusSoccerId: 3,
      GameState: "LIVE",
      ScoreSoccer: { Home: 1, Away: 0 },
      DataSoccer: { possession: 61 },
      Possession: "home",
      PossessionType: "attacking",
      Parti1StateSoccer: { pressure: "high" },
      Parti2StateSoccer: { pressure: "low" },
      PossibleEvent: { goal: true }
    }
  ];

  const result = analyzeTxlineScoresPayload(payload, {
    fixtureId: "17952170",
    receivedAt: new Date(1781226005000)
  });

  assert.equal(result.audit.scorePayloadAvailable, true);
  assert.equal(result.audit.latestSeq, 9);
  assert.deepEqual(result.audit.possessionTypeValues, ["attacking"]);
  assert.equal(result.audit.possibleEventPresent, true);
  assert.ok(result.audit.possibleEventFieldsFound.includes("PossibleEvent"));
  assert.equal(result.audit.missingFields.length, 0);
  assert.equal(result.latencyMs, 5000);
});

test("runtime audit does not emit shape warnings when score and odds records are recognized", async () => {
  const result = await runAuditWithPayloads({
    scorePayload: [
      {
        Seq: 9,
        Ts: 1781226000000,
        FixtureId: 17952170,
        PossessionType: "attacking"
      }
    ],
    oddsPayload: [
      {
        BookmakerId: 10021,
        Bookmaker: "TXLineStablePriceDemargined",
        Pct: [50, 50],
        Ts: 1781226000000
      }
    ]
  });

  assert.ok(!result.summary.dataQuality.warnings.includes("Odds snapshot payload shape was not recognized."));
  assert.ok(!result.summary.dataQuality.warnings.includes("Score snapshot payload shape was not recognized."));
});

test("possessionType found is not globally missing", async () => {
  const result = await runAuditWithPayloads({
    scorePayload: [
      {
        Seq: 1,
        Ts: 1781226000000,
        FixtureId: 17952170,
        PossessionType: "attacking"
      },
      {
        Seq: 2,
        Ts: 1781226005000,
        FixtureId: 17952170
      }
    ],
    oddsPayload: [
      {
        BookmakerId: 10021,
        Bookmaker: "TXLineStablePriceDemargined",
        Pct: [50, 50],
        Ts: 1781226000000
      }
    ]
  });

  assert.equal(result.summary.scores.possessionTypePresent, true);
  assert.ok(!result.summary.dataQuality.missingCriticalFields.includes("scores.possessionType"));
});

test("pctSumAvg is calculated from fully numeric rows", () => {
  const result = analyzeTxlineOddsPayload([
    { Pct: ["36.127", "46.125", "17.737"] },
    { Pct: ["51.653", "27.473", "20.872"] }
  ], {
    fixtureId: "17588223",
    receivedAt: new Date(1781226010000)
  });

  assert.ok(result.audit.pct.pctSumMin !== null);
  assert.ok(result.audit.pct.pctSumMax !== null);
  assert.ok(result.audit.pct.pctSumAvg !== null);
  assert.ok(Math.abs(result.audit.pct.pctSumMin - 99.989) < 0.01);
  assert.ok(Math.abs(result.audit.pct.pctSumMax - 99.998) < 0.01);
  assert.ok(Math.abs(result.audit.pct.pctSumAvg - 99.9935) < 0.01);
});

test("pctSumAvg ignores rows with NA values", () => {
  const result = analyzeTxlineOddsPayload([
    { Pct: ["36.127", "46.125", "17.737"] },
    { Pct: ["NA", "NA"] }
  ], {
    fixtureId: "17588223",
    receivedAt: new Date(1781226010000)
  });

  assert.equal(result.audit.pct.numericCount, 3);
  assert.equal(result.audit.pct.naCount, 2);
  assert.ok(result.audit.pct.pctSumAvg !== null);
  assert.ok(Math.abs(result.audit.pct.pctSumAvg - 99.989) < 0.01);
});

test("score fieldPresence is summarized in the runtime audit", async () => {
  const result = await runAuditWithPayloads({
    scorePayload: [
      {
        Seq: 1,
        Ts: 1781226000000,
        FixtureId: 17952170,
        PossessionType: "attacking"
      },
      {
        Seq: 2,
        Ts: 1781226005000,
        FixtureId: 17952170
      },
      {
        Seq: 3,
        Ts: 1781226010000,
        FixtureId: 17952170,
        PossessionType: "defensive"
      }
    ],
    oddsPayload: [
      {
        BookmakerId: 10021,
        Bookmaker: "TXLineStablePriceDemargined",
        Pct: [50, 50],
        Ts: 1781226000000
      }
    ]
  });

  assert.equal(result.summary.scores.fieldPresence.possessionType.present, 2);
  assert.equal(result.summary.scores.fieldPresence.possessionType.total, 3);
  assert.equal(result.summary.scores.fieldPresence.possessionType.rate, 2 / 3);
});

test("odds fieldPresence is summarized in the runtime audit", async () => {
  const result = await runAuditWithPayloads({
    scorePayload: [
      {
        Seq: 1,
        Ts: 1781226000000,
        FixtureId: 17952170,
        PossessionType: "attacking"
      }
    ],
    oddsPayload: [
      {
        BookmakerId: 10021,
        Bookmaker: "TXLineStablePriceDemargined",
        MarketPeriod: "FULL_TIME",
        Pct: [50, 50],
        Ts: 1781226000000
      },
      {
        BookmakerId: 10021,
        Bookmaker: "TXLineStablePriceDemargined",
        Pct: [50, 50],
        Ts: 1781226005000
      },
      {
        BookmakerId: 10021,
        Bookmaker: "TXLineStablePriceDemargined",
        Pct: [50, 50],
        Ts: 1781226010000
      }
    ]
  });

  assert.equal(result.summary.odds.fieldPresence.BookmakerId.present, 3);
  assert.equal(result.summary.odds.fieldPresence.Pct.present, 3);
  assert.equal(result.summary.odds.fieldPresence.MarketPeriod.present, 1);
});

test("latency mode is historical_snapshot_age when asOf is used", async () => {
  const result = await runAuditWithPayloads({
    scorePayload: [
      {
        Seq: 1,
        Ts: 1781226000000,
        FixtureId: 17952170,
        PossessionType: "attacking"
      }
    ],
    oddsPayload: [
      {
        BookmakerId: 10021,
        Bookmaker: "TXLineStablePriceDemargined",
        Pct: [50, 50],
        Ts: 1781226000000
      }
    ],
    input: {
      asOf: 1781226000000,
      scoreAsOfByFixtureId: {
        "17952170": 1781226000000
      },
      oddsAsOfByFixtureId: {
        "17952170": 1781226000000
      }
    }
  });

  assert.equal(result.summary.latency.mode, "historical_snapshot_age");
});

test("missing fields and unexpected shapes do not crash", () => {
  const scoreResult = analyzeTxlineScoresPayload({ foo: "bar" }, {
    fixtureId: "17952170",
    receivedAt: new Date(1781226005000)
  });
  const oddsResult = analyzeTxlineOddsPayload({ foo: "bar" }, {
    fixtureId: "17952170",
    receivedAt: new Date(1781226005000)
  });

  assert.equal(scoreResult.audit.scorePayloadAvailable, false);
  assert.equal(oddsResult.audit.payloadsFetched, 0);
  assert.ok(scoreResult.findings.some((finding) => finding.category === "payload_shape"));
  assert.ok(oddsResult.findings.some((finding) => finding.category === "payload_shape"));
});

test("latency helper returns null when provider timestamp is missing", () => {
  assert.equal(calculateLatencyMs(new Date(2000), null), null);
  assert.equal(extractBestProviderTimestamp({ foo: "bar" }), null);
});

test("scoreFixtureIds limits score requests and oddsFixtureIds limits odds requests", async () => {
  const scoreCalls: Array<{ fixtureId: string; asOf: number }> = [];
  const oddsCalls: Array<{ fixtureId: string; asOf: number }> = [];

  const result = await runTxlineRuntimeAudit(
    {
      fixtureIds: ["17952170", "17588223"],
      scoreFixtureIds: ["17952170"],
      oddsFixtureIds: ["17588223"],
      competitionId: 430,
      startEpochDay: 20608,
      includeFixtures: true,
      includeScores: true,
      includeOdds: true,
      scoreAsOfByFixtureId: {
        "17952170": 1780596263367
      },
      oddsAsOfByFixtureId: {
        "17588223": 1781226000000
      },
      notes: "test"
    },
    {
      now: () => new Date("2026-07-09T10:00:00.000Z"),
      store: createInMemoryAuditStore(),
      fetch: {
        fetchFixtures: async () => [
          {
            FixtureId: "17952170",
            CompetitionId: 430,
            Participant1: "Alpha",
            Participant2: "Beta",
            StartTime: 1781226000000,
            Ts: 1781226000000
          },
          {
            FixtureId: "17588223",
            CompetitionId: 430,
            Participant1: "Gamma",
            Participant2: "Delta",
            StartTime: 1781229600000,
            Ts: 1781229600000
          }
        ],
        fetchScores: async (params) => {
          scoreCalls.push(params);
          return [
            {
              Seq: 1,
              Ts: 1780596263367,
              FixtureId: 17952170,
              PossessionType: "attacking"
            }
          ];
        },
        fetchOdds: async (params) => {
          oddsCalls.push(params);
          return [
            {
              BookmakerId: 10021,
              Bookmaker: "TXLineStablePriceDemargined",
              Pct: [50, 50],
              Ts: 1781226000000
            }
          ];
        }
      }
    }
  );

  assert.deepEqual(scoreCalls, [{ fixtureId: "17952170", asOf: 1780596263367 }]);
  assert.deepEqual(oddsCalls, [{ fixtureId: "17588223", asOf: 1781226000000 }]);
  assert.deepEqual(result.summary.targets.scoreFixtureIds, ["17952170"]);
  assert.deepEqual(result.summary.targets.oddsFixtureIds, ["17588223"]);
});

test("score and odds default to fixtureIds when targeted lists are omitted", async () => {
  const scoreCalls: Array<{ fixtureId: string; asOf: number }> = [];
  const oddsCalls: Array<{ fixtureId: string; asOf: number }> = [];

  const result = await runTxlineRuntimeAudit(
    {
      fixtureIds: ["17952170", "17588223"],
      competitionId: 430,
      startEpochDay: 20608,
      includeFixtures: true,
      includeScores: true,
      includeOdds: true,
      asOf: 1781226000000,
      notes: "test"
    },
    {
      now: () => new Date("2026-07-09T10:00:00.000Z"),
      store: createInMemoryAuditStore(),
      fetch: {
        fetchFixtures: async () => [
          {
            FixtureId: "17952170",
            CompetitionId: 430,
            Participant1: "Alpha",
            Participant2: "Beta",
            StartTime: 1781226000000,
            Ts: 1781226000000
          },
          {
            FixtureId: "17588223",
            CompetitionId: 430,
            Participant1: "Gamma",
            Participant2: "Delta",
            StartTime: 1781229600000,
            Ts: 1781229600000
          }
        ],
        fetchScores: async (params) => {
          scoreCalls.push(params);
          return [
            {
              Seq: 1,
              Ts: 1781226000000,
              FixtureId: params.fixtureId,
              PossessionType: "attacking"
            }
          ];
        },
        fetchOdds: async (params) => {
          oddsCalls.push(params);
          return [
            {
              BookmakerId: 10021,
              Bookmaker: "TXLineStablePriceDemargined",
              Pct: [50, 50],
              Ts: 1781226000000
            }
          ];
        }
      }
    }
  );

  assert.deepEqual(scoreCalls, [
    { fixtureId: "17952170", asOf: 1781226000000 },
    { fixtureId: "17588223", asOf: 1781226000000 }
  ]);
  assert.deepEqual(oddsCalls, [
    { fixtureId: "17952170", asOf: 1781226000000 },
    { fixtureId: "17588223", asOf: 1781226000000 }
  ]);
  assert.deepEqual(result.summary.targets.scoreFixtureIds, ["17952170", "17588223"]);
  assert.deepEqual(result.summary.targets.oddsFixtureIds, ["17952170", "17588223"]);
});

test("missing asOf only applies to selected score targets", async () => {
  const result = await runTxlineRuntimeAudit(
    {
      fixtureIds: ["17952170", "17588223"],
      scoreFixtureIds: ["17952170"],
      competitionId: 430,
      startEpochDay: 20608,
      includeFixtures: false,
      includeScores: true,
      includeOdds: false,
      notes: "test"
    },
    {
      now: () => new Date("2026-07-09T10:00:00.000Z"),
      store: createInMemoryAuditStore()
    }
  );

  assert.deepEqual(result.summary.asOf.missingScoreAsOfFixtureIds, ["17952170"]);
  assert.ok(!result.summary.asOf.missingScoreAsOfFixtureIds.includes("17588223"));
});

test("targeted audit request count only includes fixtures plus selected score and odds targets", async () => {
  const result = await runTxlineRuntimeAudit(
    {
      fixtureIds: ["17952170", "17588223"],
      scoreFixtureIds: ["17952170"],
      oddsFixtureIds: ["17588223"],
      competitionId: 430,
      startEpochDay: 20608,
      includeFixtures: true,
      includeScores: true,
      includeOdds: true,
      scoreAsOfByFixtureId: {
        "17952170": 1780596263367
      },
      oddsAsOfByFixtureId: {
        "17588223": 1781226000000
      },
      notes: "test"
    },
    {
      now: () => new Date("2026-07-09T10:00:00.000Z"),
      store: createInMemoryAuditStore(),
      fetch: {
        fetchFixtures: async () => [
          {
            FixtureId: "17952170",
            CompetitionId: 430,
            Participant1: "Alpha",
            Participant2: "Beta",
            StartTime: 1781226000000,
            Ts: 1781226000000
          },
          {
            FixtureId: "17588223",
            CompetitionId: 430,
            Participant1: "Gamma",
            Participant2: "Delta",
            StartTime: 1781229600000,
            Ts: 1781229600000
          }
        ],
        fetchScores: async () => [
          {
            Seq: 1,
            Ts: 1780596263367,
            FixtureId: 17952170,
            PossessionType: "attacking"
          }
        ],
        fetchOdds: async () => [
          {
            BookmakerId: 10021,
            Bookmaker: "TXLineStablePriceDemargined",
            Pct: [50, 50],
            Ts: 1781226000000
          }
        ]
      }
    }
  );

  assert.equal(result.summary.requests.attempted, 3);
});

test("summary includes target fixture metadata", async () => {
  const result = await runTxlineRuntimeAudit(
    {
      fixtureIds: ["17952170", "17588223"],
      scoreFixtureIds: ["17952170"],
      oddsFixtureIds: ["17588223"],
      competitionId: 430,
      startEpochDay: 20608,
      includeFixtures: true,
      includeScores: true,
      includeOdds: true,
      scoreAsOfByFixtureId: {
        "17952170": 1780596263367
      },
      oddsAsOfByFixtureId: {
        "17588223": 1781226000000
      },
      notes: "test"
    },
    {
      now: () => new Date("2026-07-09T10:00:00.000Z"),
      store: createInMemoryAuditStore(),
      fetch: {
        fetchFixtures: async () => [
          {
            FixtureId: "17952170",
            CompetitionId: 430,
            Participant1: "Alpha",
            Participant2: "Beta",
            StartTime: 1781226000000,
            Ts: 1781226000000
          },
          {
            FixtureId: "17588223",
            CompetitionId: 430,
            Participant1: "Gamma",
            Participant2: "Delta",
            StartTime: 1781229600000,
            Ts: 1781229600000
          }
        ],
        fetchScores: async () => [
          {
            Seq: 1,
            Ts: 1780596263367,
            FixtureId: 17952170,
            PossessionType: "attacking"
          }
        ],
        fetchOdds: async () => [
          {
            BookmakerId: 10021,
            Bookmaker: "TXLineStablePriceDemargined",
            Pct: [50, 50],
            Ts: 1781226000000
          }
        ]
      }
    }
  );

  assert.deepEqual(result.summary.targets.fixtureIds, ["17952170", "17588223"]);
  assert.deepEqual(result.summary.targets.scoreFixtureIds, ["17952170"]);
  assert.deepEqual(result.summary.targets.oddsFixtureIds, ["17588223"]);
});

test("runtime audit skips score and odds when asOf is missing", async () => {
  const fixturesPayload = [
    {
      FixtureId: "17952170",
      CompetitionId: 430,
      Participant1: "Alpha",
      Participant2: "Beta",
      StartTime: 1781226000000,
      Ts: 1781226000000
    }
  ];

  const result = await runTxlineRuntimeAudit(
    {
      fixtureIds: ["17952170"],
      competitionId: 430,
      startEpochDay: 20608,
      includeFixtures: true,
      includeScores: true,
      includeOdds: true,
      notes: "test"
    },
    {
      now: () => new Date("2026-07-09T10:00:00.000Z"),
      store: createInMemoryAuditStore(),
      fetch: {
        fetchFixtures: async () => fixturesPayload
      }
    }
  );

  assert.equal(result.summary.status, "completed_with_warnings");
  assert.equal(result.summary.requests.attempted, 1);
  assert.equal(result.summary.requests.succeeded, 1);
  assert.equal(result.summary.requests.failed, 0);
  assert.equal(result.summary.requests.skipped, 2);
  assert.deepEqual(result.summary.asOf.missingScoreAsOfFixtureIds, ["17952170"]);
  assert.deepEqual(result.summary.asOf.missingOddsAsOfFixtureIds, ["17952170"]);
  assert.ok(result.findings.some((finding) => finding.category === "missing_asOf"));
  assert.equal(result.raw_payloads.length, 1);
});

test("fixture-specific asOf overrides the global asOf and later failures preserve earlier payloads", async () => {
  const fixtureCalls: Array<{ competitionId: string; startEpochDay: number }> = [];
  const scoreCalls: Array<{ fixtureId: string; asOf: number }> = [];
  const oddsCalls: Array<{ fixtureId: string; asOf: number }> = [];
  const timeoutError = new TxlineLiveError({
    endpointPath: "/scores/snapshot/17952170",
    endpointHost: "txline.example",
    kind: "timeout",
    message: "The TxLINE request timed out."
  });

  const result = await runTxlineRuntimeAudit(
    {
      fixtureIds: ["17952170"],
      competitionId: 430,
      startEpochDay: 20608,
      includeFixtures: true,
      includeScores: true,
      includeOdds: true,
      asOf: 1781226000000,
      scoreAsOfByFixtureId: {
        "17952170": 1780596263367
      },
      notes: "test"
    },
    {
      now: () => new Date("2026-07-09T10:00:00.000Z"),
      store: createInMemoryAuditStore(),
      fetch: {
        fetchFixtures: async (params) => {
          fixtureCalls.push(params);
          return [
            {
              FixtureId: "17952170",
              CompetitionId: 430,
              Participant1: "Alpha",
              Participant2: "Beta",
              StartTime: 1781226000000,
              Ts: 1781226000000
            }
          ];
        },
        fetchScores: async (params) => {
          scoreCalls.push(params);
          throw timeoutError;
        },
        fetchOdds: async (params) => {
          oddsCalls.push(params);
          return [
            {
              BookmakerId: 10021,
              Bookmaker: "TXLineStablePriceDemargined",
              Pct: [50, 50],
              Ts: 1781226000000
            }
          ];
        }
      }
    }
  );

  assert.equal(scoreCalls[0]?.asOf, 1780596263367);
  assert.equal(oddsCalls[0]?.asOf, 1781226000000);
  assert.equal(result.summary.status, "completed_with_warnings");
  assert.equal(result.summary.requests.attempted, 3);
  assert.equal(result.summary.requests.succeeded, 2);
  assert.equal(result.summary.requests.failed, 1);
  assert.equal(result.summary.requests.skipped, 0);
  assert.equal(result.raw_payloads.length, 2);
  assert.ok(result.findings.some((finding) => finding.category === "txline_request"));
  const requestFinding = result.findings.find((finding) => finding.category === "txline_request");
  assert.equal((requestFinding?.detailsJson as { reason?: string } | undefined)?.reason, "timeout");
  assert.deepEqual(fixtureCalls, [{ competitionId: "430", startEpochDay: 20608 }]);
});

test("all runtime audit requests failing returns failed status", async () => {
  const timeoutError = new TxlineLiveError({
    endpointPath: "/fixtures/snapshot",
    endpointHost: "txline.example",
    kind: "timeout",
    message: "The TxLINE request timed out."
  });

  const result = await runTxlineRuntimeAudit(
    {
      fixtureIds: ["17952170"],
      competitionId: 430,
      startEpochDay: 20608,
      includeFixtures: true,
      includeScores: true,
      includeOdds: true,
      asOf: 1781226000000,
      notes: "test"
    },
    {
      now: () => new Date("2026-07-09T10:00:00.000Z"),
      store: createInMemoryAuditStore(),
      fetch: {
        fetchFixtures: async () => {
          throw timeoutError;
        },
        fetchScores: async () => {
          throw timeoutError;
        },
        fetchOdds: async () => {
          throw timeoutError;
        }
      }
    }
  );

  assert.equal(result.summary.status, "failed");
  assert.equal(result.summary.requests.succeeded, 0);
  assert.equal(result.summary.requests.failed, 3);
  assert.equal(result.summary.requests.skipped, 0);
  assert.equal(result.raw_payloads.length, 0);
  assert.ok(result.findings.every((finding) => finding.category === "txline_request"));
});
