import { randomUUID } from "node:crypto";
import {
  DEFAULT_TXLINE_DEMO_SEED_ID,
  findTxlineDemoSeedById,
  type TxlineDemoSeed
} from "./txline-demo-seeds.js";
import {
  buildTxlineReplaySummary,
  buildTxlineReplayTimeline,
  type TxlineReplayEvent,
  type TxlineReplaySummary
} from "./txline-replay.js";

export const REPLAY_SPEEDS = [1, 2, 5] as const;

export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];
export type ReplaySessionStatus = "running" | "paused" | "finished" | "stopped";

export type ReplaySession = {
  session_id: string;
  seed: string;
  fixture_id: string;
  status: ReplaySessionStatus;
  speed: ReplaySpeed;
  current_index: number;
  current_minute: number | null;
  started_at: string;
  updated_at: string;
};

export type ReplayState = {
  fixture_id: string;
  current_event: TxlineReplayEvent | null;
  current_index: number;
  timeline_count: number;
  progress_percent: number;
  summary: TxlineReplaySummary;
};

export class ReplaySessionValidationError extends Error {
  constructor(
    public readonly code: "invalid_speed" | "seed_not_found",
    message: string
  ) {
    super(message);
    this.name = "ReplaySessionValidationError";
  }
}

type StoredReplay = {
  session: ReplaySession;
  timeline: TxlineReplayEvent[];
};

const replaySessions = new Map<string, StoredReplay>();

function parseReplaySpeed(speed: unknown): ReplaySpeed {
  if (REPLAY_SPEEDS.some((candidate) => candidate === speed)) {
    return speed as ReplaySpeed;
  }

  throw new ReplaySessionValidationError(
    "invalid_speed",
    "speed must be one of: 1, 2, 5."
  );
}

function buildDemoTimeline(seed: TxlineDemoSeed) {
  return buildTxlineReplayTimeline(
    [
      {
        FixtureId: seed.fixtureId,
        Seq: seed.knownSeq,
        Action: seed.knownAction,
        Score: {
          Participant1: { Total: { Goals: seed.knownScore.home } },
          Participant2: { Total: { Goals: seed.knownScore.away } }
        }
      }
    ],
    {
      fixtureId: seed.fixtureId,
      participant1IsHome: true
    }
  );
}

export function createReplaySession(input: { seed?: string; speed?: unknown } = {}) {
  const seedId = input.seed ?? DEFAULT_TXLINE_DEMO_SEED_ID;
  const seed = findTxlineDemoSeedById(seedId);

  if (seed === undefined) {
    throw new ReplaySessionValidationError("seed_not_found", "Replay seed not found.");
  }

  const speed = parseReplaySpeed(input.speed === undefined ? 1 : input.speed);
  const now = new Date().toISOString();
  const session: ReplaySession = {
    session_id: randomUUID(),
    seed: seed.id,
    fixture_id: seed.fixtureId,
    status: "running",
    speed,
    current_index: 0,
    current_minute: null,
    started_at: now,
    updated_at: now
  };
  const timeline = buildDemoTimeline(seed);

  replaySessions.set(session.session_id, { session, timeline });
  return { session, timeline };
}

export function getReplaySession(sessionId: string): StoredReplay | null {
  return replaySessions.get(sessionId) ?? null;
}

export function buildReplayState(
  session: ReplaySession,
  timeline: readonly TxlineReplayEvent[]
): ReplayState {
  const currentEvent = timeline[session.current_index] ?? null;
  const progressPercent = timeline.length <= 1
    ? session.current_index === 0 ? 0 : 100
    : Math.min(100, Math.max(0, (session.current_index / (timeline.length - 1)) * 100));

  return {
    fixture_id: session.fixture_id,
    current_event: currentEvent,
    current_index: session.current_index,
    timeline_count: timeline.length,
    progress_percent: progressPercent,
    summary: buildTxlineReplaySummary(timeline)
  };
}
