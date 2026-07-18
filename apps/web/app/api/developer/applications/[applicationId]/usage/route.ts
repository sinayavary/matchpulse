import { NextResponse } from "next/server";
export async function GET() { return NextResponse.json({ data: { requestsToday: 0, quotaRemaining: 120 } }); }
