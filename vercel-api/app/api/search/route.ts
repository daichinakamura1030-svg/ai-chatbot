// vercel-api/app/api/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { searchKnowledge } from "@/lib/knowledge";
import { gptAnswer } from "@/lib/llm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (!q) return NextResponse.json({ error: "q is required" }, { status: 400 });

    // 1) fuzzy 検索（ローカル知識）
    const hits = await searchKnowledge(q, 3);

    // 2) ヒットが0なら GPT フォールバック
    if (!hits.length) {
      const answer = await gptAnswer(q);
      return NextResponse.json({
        query: q,
        from: "gpt",
        answer
      });
    }

    // 3) ヒットがあれば knowledge 結果を返す（必要ならここで answer 生成も可能）
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
    // エラーをJSONで返して調査しやすく
    return NextResponse.json(
      { error: "internal_error", message: e?.message || String(e) },
      { status: 500 }
    );
  }
}
