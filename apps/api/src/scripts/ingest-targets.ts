import { runTargetIngestionCycle } from "../ingestion-runner.js";

const summary = await runTargetIngestionCycle({
  fixtures: true,
  scores: true,
  odds: true
});

console.log(JSON.stringify(summary, null, 2));
