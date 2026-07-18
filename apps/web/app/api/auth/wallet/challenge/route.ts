import { proxyBackend } from "../../../../../lib/backend-auth-proxy";
export async function POST(request: Request) { return proxyBackend("/api/auth/wallet/challenge", { method: "POST", headers: { "content-type": "application/json", origin: request.headers.get("origin") ?? "", referer: request.headers.get("referer") ?? "" }, body: await request.text() }); }
