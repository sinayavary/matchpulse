import { NextResponse } from "next/server";
export async function GET(request: Request) { const cookie = request.headers.get("cookie") ?? ""; return NextResponse.json({ authenticated: cookie.includes("mp_session=") }); }
