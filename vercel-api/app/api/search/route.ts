import { NextRequest, NextResponse } from "next/server";
import { searchKnowledge } from "@/lib/knowledge"; // もしくは "../../../lib/knowledge"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    if (!q) {
      return NextResponse.json({ error: "q is required" }, { status: 400 });
    }

    const hits = await searchKnowledge(q, 3);

    return NextResponse.json({
      query: q,
      hits: hits.map(h => ({
        source: h.source,
        preview: h.content.slice(0, 400) + (h.content.length > 400 ? "..." : "")
      }))
    });
  } catch (e: any) {
    // 👇ここがポイント：実際のエラーメッセージを見えるようにする
    return NextResponse.json(
      {
        error: "internal_error",
        message: e?.message || String(e)
      },
      { status: 500 }
    );
  }
}
