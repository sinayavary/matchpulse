import { NextResponse } from "next/server";
import { backendOrigin } from "../../../../../lib/backend-auth-proxy";
const allowed = new Set(["status", "competitions", "matches", "matches/replay", "live"]);
function allowedPath(path: string) { return [...allowed].some((value) => path === `/api/public/${value}` || path.startsWith(`/api/public/${value}/`)); }
export async function GET(request: Request, context: { params: Promise<{ segments: string[] }> }) {
  const { segments } = await context.params;
  const path = `/api/public/${segments.map(decodeURIComponent).join("/")}`;
  if (!backendOrigin || segments.some((segment) => !/^[A-Za-z0-9_:-]+$/.test(segment)) || !allowedPath(path)) return NextResponse.json({ error: "request_rejected", message: "The request could not be completed." }, { status: 404 });
  const url = new URL(request.url); const query = new URLSearchParams(); const live = path.endsWith("/live");
  const allowedQueryKeys = live ? ["cursor", "fixtureId", "types"] : ["range", "limit", "cursor", "competitionId", "from", "to", "includeOdds", "includeState", "includeSignals", "includeBrief", "staleAfterMinutes", "oddsLimit"];
  for (const key of allowedQueryKeys) { const value = url.searchParams.get(key); if (value !== null) query.set(key, value); }
  const response = await fetch(`${backendOrigin}${path}${query.size ? `?${query}` : ""}`, { headers: { accept: live ? "text/event-stream" : "application/json", cookie: request.headers.get("cookie") ?? "", ...(live && request.headers.get("last-event-id") ? { "last-event-id": request.headers.get("last-event-id")! } : {}) }, redirect: "manual", signal: live ? undefined : AbortSignal.timeout(5000) });
  if (response.status >= 300 && response.status < 400) return NextResponse.json({ error: "request_rejected", message: "The request could not be completed." }, { status: 502 });
  if (live) {
    if (response.headers.get("content-type")?.split(";", 1)[0] !== "text/event-stream") return NextResponse.json({ error: "upstream_rejected", message: "The live stream is unavailable." }, { status: 502 });
    return new Response(response.body, { status: response.status, headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" } });
  }
  const text = await response.text(); if (text.length > 5_000_000) return NextResponse.json({ error: "request_rejected", message: "The request could not be completed." }, { status: 502 });
  return new NextResponse(text, { status: response.status, headers: { "content-type": response.headers.get("content-type") ?? "application/json" } });
}
