import { NextResponse } from "next/server";
export async function POST() { const response = NextResponse.json({ ok: true }); response.cookies.set("mp_session", "", { maxAge: 0, httpOnly: true, sameSite: "lax", path: "/" }); return response; }
