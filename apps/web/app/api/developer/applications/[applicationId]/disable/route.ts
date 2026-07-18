import { NextResponse } from "next/server";
export async function POST(_: Request, context: { params: Promise<{ applicationId: string }> }) { const { applicationId } = await context.params; return NextResponse.json({ data: { id: applicationId, disabled: true } }); }
