// vercel-api/app/api/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { searchKnowledge } from "@/lib/knowledge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  if (!q) return NextResponse.json({ error: "q is required" }, { status: 400 });

  const hits = await searchKnowledge(q, 3);

  return NextResponse.json({
    query: q,
    hits: hits.map(h => ({ source: h.source, preview: h.content.slice(0, 400) + "..." }))
  });
}
