import assert from "node:assert/strict";
import test from "node:test";
import { registerHistoricalReplayRoute } from "./historical-replay.js";

test("replay route is persisted and public-safe", () => {
  const routes: string[] = [];
  registerHistoricalReplayRoute({ get(path: string) { routes.push(path); } } as never);
  assert.deepEqual(routes, ["/api/public/matches/:fixtureId/replay"]);
});
