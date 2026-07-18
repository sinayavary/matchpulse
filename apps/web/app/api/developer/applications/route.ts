import { NextResponse } from "next/server";
export async function GET() { return NextResponse.json({ data: [] }); }
export async function POST(request: Request) { const body = await request.json(); return NextResponse.json({ data: { id: crypto.randomUUID(), name: String(body.name ?? "Untitled application"), scopes: ["matches:read"], disabled: false } }, { status: 201 }); }
