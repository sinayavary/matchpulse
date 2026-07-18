import { proxyBackend } from "../../../../lib/backend-auth-proxy";
const forward = (request: Request, method: string) => proxyBackend("/api/developer/applications", { method, headers: { "content-type": "application/json", cookie: request.headers.get("cookie") ?? "", origin: request.headers.get("origin") ?? "", referer: request.headers.get("referer") ?? "", "x-csrf-token": request.headers.get("x-csrf-token") ?? "" }, ...(method === "POST" ? { body: request.body } : {}) });
export async function GET(request: Request) { return forward(request, "GET"); }
export async function POST(request: Request) { return forward(request, "POST"); }
