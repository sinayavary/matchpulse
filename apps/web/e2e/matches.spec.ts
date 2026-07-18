import { expect, test, type Page } from "@playwright/test";

const lifecycle = { lifecycle: "scheduled", source: "provider", reason_code: "scheduled", normalized_phase: "pre_match", is_active: false, is_terminal: false, updated_at: "2026-07-18T12:00:00.000Z" };
const match = (fixtureId: string, home: string, away: string) => ({
  fixture_id: fixtureId, catalog_identity: fixtureId, competition: "Alpha Cup", home_team: home, away_team: away,
  start_time_utc: new Date(Date.now() + 3_600_000).toISOString(), status: "Scheduled", lifecycle,
  scoreboard: { available: false, home_score: null, away_score: null }, odds: { available: false, count: 0 },
  quality: { status: "partial", issues: ["score_missing"] }, latest_data_timestamp: null,
  availability: { score: "not_expected_yet", odds: "not_attempted", events: "not_attempted" }
});

async function mockPublicApi(page: Page, readiness: "ready" | "degraded" = "ready") {
  await page.route("**/api/public/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/public/status") return route.fulfill({ json: { data: { service: "matchpulse-api", ok: true, public_api_version: "public-v0", product_ready: readiness === "ready", readiness: { overall: readiness, checked_at: new Date().toISOString(), components: { database: { status: "ready", timestamp: new Date().toISOString(), reason_code: "ok" }, ingestion_worker: { status: readiness, timestamp: null, reason_code: readiness === "ready" ? "ok" : "heartbeat_stale" } } } }, meta: { status: "live", source: "database", mode: "public" } } });
    if (url.pathname === "/api/public/competitions") return route.fulfill({ json: { data: [{ competition_id: "430", name: "Alpha Cup" }], meta: { status: "live", source: "database", mode: "public" } } });
    if (url.pathname === "/api/public/matches") {
      const second = url.searchParams.has("cursor");
      return route.fulfill({ json: { data: second ? [match("f2", "Gamma", "Delta")] : [match("f1", "Alpha", "Beta")], meta: { status: "live", source: "database", mode: "public", result_count: 1, has_more: !second, next_cursor: second ? null : "cursor-1" } } });
    }
    if (url.pathname === "/api/public/matches/f1") return route.fulfill({ json: { data: { fixture_id: "f1", identity: { fixture_id: "f1", competition: "Alpha Cup", home_team: "Alpha", away_team: "Beta", start_time_utc: new Date().toISOString(), status: "Scheduled" }, scoreboard: { available: false, home_score: null, away_score: null }, odds: { available: false, count: 0 }, freshness: { latest_data_timestamp: null }, quality: { status: "partial", issues: [] } }, meta: { status: "live", source: "database", mode: "public" } } });
    if (url.pathname === "/api/public/matches/f1/bundle") return route.fulfill({ json: { data: { fixture_id: "f1", readiness: { status: "partial", display_ready: true, has_state: true, has_brief: false, has_signals: false, has_fixture: true, has_scoreboard: false, has_odds: false, issue_count: 0, issues: [] }, brief: null, signal_summary: null, signals: [], state: null }, meta: { status: "live", source: "database", mode: "public" } } });
    return route.fulfill({ status: 404, json: { data: null, meta: { status: "no_data" } } });
  });
}

test("matches supports filters, refresh, pagination, and detail navigation", async ({ page }) => {
  await mockPublicApi(page);
  await page.goto("/matches");
  await expect(page.getByText("Alpha vs Beta")).toBeVisible();
  await page.getByRole("combobox", { name: "Competition" }).selectOption("430");
  const dateRequest = page.waitForRequest((request) => request.url().includes("/api/public/matches?") && request.url().includes("competitionId=430") && request.url().includes("from=") && request.url().includes("to="));
  await page.getByRole("button", { name: "Today" }).click();
  await dateRequest;
  const tomorrowRequest = page.waitForRequest((request) => request.url().includes("/api/public/matches?") && request.url().includes("from=") && request.url().includes("to="));
  await page.getByRole("button", { name: "Tomorrow" }).click();
  await tomorrowRequest;
  await page.getByRole("button", { name: "Custom" }).click();
  await page.getByLabel("Custom range start").fill("2026-07-18");
  const customRequest = page.waitForRequest((request) => request.url().includes("/api/public/matches?") && request.url().includes("from=") && request.url().includes("to="));
  await page.getByLabel("Custom range end").fill("2026-07-20");
  await customRequest;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByText(/last refresh:/)).not.toContainText("not yet");
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(page.getByText("Gamma vs Delta")).toBeVisible();
  await page.getByText("Alpha vs Beta").click();
  await expect(page).toHaveURL(/\/matches\/f1$/);
});

test("matches exposes degraded reason and safe request errors", async ({ page }) => {
  await mockPublicApi(page, "degraded");
  await page.goto("/matches");
  await expect(page.getByText(/stale\/degraded: heartbeat_stale/)).toBeVisible();
  await page.unroute("**/api/public/**");
  await page.route("**/api/public/**", (route) => route.abort());
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByText(/temporarily unavailable/)).toBeVisible();
});

