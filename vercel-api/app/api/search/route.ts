export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { searchSnippets, type Snippet } from "../../../lib/knowledge";
import { answerWithContext } from "../../../lib/llm";
import { GRANTS_BY_BUTTON, GRANTS_BY_SLUG, type GrantMeta } from "../../../lib/grants";
import { gptAnswer } from "../../../lib/llm"; // aiOnly用に素の回答も使える

function resolveGrant(metaKey: string | null): GrantMeta | null {
  if (!metaKey) return null;
  const key = metaKey.trim();
  // まず A〜F
  if (GRANTS_BY_BUTTON[key]) return GRANTS_BY_BUTTON[key];
  // 次に slug
  if (GRANTS_BY_SLUG[key]) return GRANTS_BY_SLUG[key];
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (!q) return NextResponse.json({ error: "q is required" }, { status: 400 });

    // ここに A〜F または slug が入る想定（LINEのポストバックで渡す）
    const grantKey = searchParams.get("grant"); // 例: "A" / "jizokuka" など
    const grant = resolveGrant(grantKey);

    // F 等：aiOnly の場合は JSON 索引せずに GPT だけで回答
    if (grant?.aiOnly) {
      const answer = await gptAnswer(q);
      return NextResponse.json({
        query: q,
        from: "gpt-only",
        grant: { display: grant.display, url: grant.url },
        answer,
      });
    }

    // 1) スコープ検索（ファイル名はレスポンスに出さない）
    let snippets: Snippet[] = [];
    if (grant?.file) {
      snippets = await searchSnippets(q, 8, [grant.file]);
    }

    // 2) スコープで0件なら全体検索へフォールバック（任意）
    if (!snippets.length) {
      snippets = await searchSnippets(q, 8);
    }

    // 3) ヒットがあれば LLM 要約
    if (snippets.length) {
      const ctx = snippets.map((s) => ({
        source: grant?.display || "関連資料",
        topic: s.topic,
        content: s.content,
        where: s.where,
      }));
      const answer = await answerWithContext(q, ctx);

      return NextResponse.json({
        query: q,
        from: grant?.file ? "scoped-knowledge+gpt" : "knowledge+gpt",
        grant: grant ? { display: grant.display, url: grant.url } : undefined,
        answer,
        // ファイル名は出さず、topic / whereだけ（漏洩防止）
        sources: ctx.map((c, i) => ({
          id: i + 1,
          title: c.topic || "関連トピック",
          where: c.where,
        })),
      });
    }

    // 4) 何も拾えない場合
    return NextResponse.json({
      query: q,
      from: grant?.file ? "scoped-nohit" : "nohit",
      grant: grant ? { display: grant.display, url: grant.url } : undefined,
      answer: "該当情報が見つかりませんでした。用語を変えてもう一度お試しください。",
    });

  } catch (e: any) {
    return NextResponse.json(
      { error: "internal_error", message: e?.message || String(e) },
      { status: 500 }
    );
  }
}
