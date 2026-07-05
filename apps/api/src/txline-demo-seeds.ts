export type TxlineDemoSeed = {
  id: string;
  label: string;
  fixtureId: string;
  competitionId: number;
  startEpochDay: number;
  knownScore: {
    home: number;
    away: number;
  };
  knownAction: string;
  knownSeq: number;
  description: string;
};

export const DEFAULT_TXLINE_DEMO_SEED_ID = "slovenia-cyprus-2026-friendly";

export const TXLINE_DEMO_SEEDS: TxlineDemoSeed[] = [
  {
    id: DEFAULT_TXLINE_DEMO_SEED_ID,
    label: "Slovenia vs Cyprus - Friendlies 2026",
    fixtureId: "17952170",
    competitionId: 430,
    startEpochDay: 20608,
    knownScore: { home: 1, away: 1 },
    knownAction: "game_finalised",
    knownSeq: 960,
    description: "Known-good TxLINE score sample for internal live preview QA."
  }
];

export function findTxlineDemoSeedById(seedId: string): TxlineDemoSeed | undefined {
  return TXLINE_DEMO_SEEDS.find((seed) => seed.id === seedId);
}
