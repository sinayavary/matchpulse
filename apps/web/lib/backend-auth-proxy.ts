export const backendOrigin = process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:4000";
export const safeBackendPath = (segments: string[]) => { const path = `/${segments.join("/")}`; if (!path.startsWith("/api/matches") && !path.startsWith("/api/events") && !path.startsWith("/api/scenarios")) return undefined; return path; };
