// vercel-api/lib/knowledge.ts
import { promises as fs } from "fs";
import path from "path";

type KnowledgeIndex = {
  files: string[];
  last_updated?: string;
};

export type Doc = {
  source: string;     // ファイル名
  content: string;    // テキスト化した中身
  raw: any;           // 元JSON（必要なら）
};

const KNOWLEDGE_DIR = path.join(process.cwd(), "data", "knowledge");
const INDEX_PATH = path.join(KNOWLEDGE_DIR, "index.json");

// メモリキャッシュ（Vercelの関数はコールドスタート毎に初期化）
let CACHE: { loadedAt: number; docs: Doc[] } | null = null;

export async function loadKnowledge(force = false): Promise<Doc[]> {
  if (!force && CACHE?.docs) return CACHE.docs;

  // 1) index.json 読み込み
  const indexRaw = await fs.readFile(INDEX_PATH, "utf-8");
  const index: KnowledgeIndex = JSON.parse(indexRaw);

  // 2) 各JSONを読み込み
  const docs: Doc[] = [];
  for (const file of index.files) {
    const p = path.join(KNOWLEDGE_DIR, file);
    const rawText = await fs.readFile(p, "utf-8");
    const json = JSON.parse(rawText);

    // “テキスト化” はまずは超シンプル：JSON全体を整形して文字列化
    // （後でRAG用に項目ごと・段落ごとに分割するのに差し替えOK）
    const content = toFlatText(json);

    docs.push({ source: file, content, raw: json });
  }

  CACHE = { loadedAt: Date.now(), docs };
  return docs;
}

// 簡易：JSONを人が読める文章っぽく平坦化
function toFlatText(obj: any): string {
  if (obj == null) return "";
  if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") {
    return String(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(toFlatText).join("\n");
  }
  if (typeof obj === "object") {
    return Object.entries(obj)
      .map(([k, v]) => `【${k}】\n${toFlatText(v)}`)
      .join("\n");
  }
  return "";
}

// キーワード簡易検索（RAG導入前の仮検索）
export async function searchKnowledge(query: string, topK = 3) {
  const docs = await loadKnowledge();
  const q = query.toLowerCase();

  const scored = docs
    .map(d => {
      // すごく簡易：出現回数ベース
      const count = (d.content.toLowerCase().match(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
      return { doc: d, score: count };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored.map(s => s.doc);
}
