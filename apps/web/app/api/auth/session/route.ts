import { proxyBackend } from "../../../../lib/backend-auth-proxy";
export async function GET(request: Request) { return proxyBackend("/api/auth/session", { headers: { cookie: request.headers.get("cookie") ?? "", accept: "application/json" } }); }
