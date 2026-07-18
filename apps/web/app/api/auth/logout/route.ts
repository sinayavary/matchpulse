import { proxyBackend } from "../../../../lib/backend-auth-proxy";
export async function POST(request: Request) { return proxyBackend("/api/auth/logout", { method: "POST", headers: { cookie: request.headers.get("cookie") ?? "", origin: request.headers.get("origin") ?? "", referer: request.headers.get("referer") ?? "", "x-csrf-token": request.headers.get("x-csrf-token") ?? "" } }); }
