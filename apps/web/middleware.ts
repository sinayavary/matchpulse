import { NextResponse, type NextRequest } from "next/server";
export function middleware(request: NextRequest) { if (request.nextUrl.pathname.startsWith("/api/internal")) return new NextResponse("Not found", { status: 404 }); return NextResponse.next(); }
export const config = { matcher: ["/api/:path*"] };
