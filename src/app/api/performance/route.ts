import { NextResponse } from "next/server";
import { pullPublicRecord } from "@/lib/performance-server";

// Public, like /performance: percentages and R only. Cached at the edge for 5 minutes.
export const revalidate = 300;

export async function GET() {
  const result = await pullPublicRecord();
  return NextResponse.json(result, {
    status: result.ok ? 200 : 503,
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
