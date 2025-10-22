// vercel-api/app/api/search/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
// ← ここを相対パスに（app/api/search から lib へは 3 つ戻る）
import { searchKnowledge } from "../../../lib/knowledge";
import { gptAnswer } from "../../../lib/llm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (!q) return NextResponse.json({ error: "q is required" }, { status: 400 });

    const hits = await searchKnowledge(q, 3);

    if (!hits.length) {
      const answer = await gptAnswer(q);
      return NextResponse.json({ query: q, from: "gpt", answer });
    }

    return NextResponse.json({
      query: q,
      from: "knowledge",
      hits: hits.map(h => ({
        source: h.source,
        preview:
          h.content.slice(0, 500).replace(/\s+/g, " ") +
          (h.content.length > 500 ? "..." : "")
      }))
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "internal_error", message: e?.message || String(e) },
      { status: 500 }
    );
  }
}
