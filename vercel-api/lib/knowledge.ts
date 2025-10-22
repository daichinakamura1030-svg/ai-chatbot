// vercel-api/lib/knowledge.ts
import { promises as fs } from "fs";
import path from "path";

type KnowledgeIndex = {
  files: string[];
  last_updated?: string;
};

export type Doc = {
  source: string;   // ファイル名
  content: string;  // テキスト化した中身
  raw: any;         // 元JSON（必要なら）
};

// データ配置：vercel-api/data/knowledge/*
const KNOWLEDGE_DIR = path.join(process.cwd(), "data", "knowledge");
const INDEX_PATH = path.join(KNOWLEDGE_DIR, "index.json");

// メモリキャッシュ
let CACHE: { loadedAt: number; docs: Doc[] } | null = null;

export async function loadKnowledge(force = false): Promise<Doc[]> {
  if (!force && CACHE?.docs) return CACHE.docs;

  const indexRaw = await fs.readFile(INDEX_PATH, "utf-8");
  const index: KnowledgeIndex = JSON.parse(indexRaw);

  const docs: Doc[] = [];
  for (const file of index.files) {
    const p = path.join(KNOWLEDGE_DIR, file);
    const rawText = await fs.readFile(p, "utf-8");
    if (!rawText.trim()) {
      console.warn(`[knowledge] empty file skipped: ${file}`);
      continue;
    }
    try {
      const json = JSON.parse(rawText);
      const content = toFlatText(json);
      docs.push({ source: file, content, raw: json });
    } catch (e: any) {
      console.warn(`[knowledge] skip invalid JSON ${file}: ${e?.message || e}`);
    }
  }

  CACHE = { loadedAt: Date.now(), docs };
  return docs;
}

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

/* ==== fuzzy検索 ==== */
function normalizeJa(text: string) {
  return text
    .normalize("NFKC")
    .replace(/[ァ-ン]/g, s => String.fromCharCode(s.charCodeAt(0) - 0x60)) // カタカナ→ひらがな
    .toLowerCase();
}
function tokenize(q: string) {
  return normalizeJa(q)
    .replace(/[。、，・,\.!?！？\s]+/g, " ")
    .split(" ")
    .filter(Boolean);
}
function scoreText(text: string, keywords: string[]) {
  const t = normalizeJa(text);
  let score = 0;
  for (const kw of keywords) {
    const stem = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 4);
    if (!stem) continue;
    const re = new RegExp(stem, "g");
    const hit = t.match(re);
    if (hit) score += hit.length;
  }
  return score;
}

/** ←← これが “名前付きエクスポート” 本体 */
export async function searchKnowledge(query: string, topK = 3): Promise<Doc[]> {
  const docs = await loadKnowledge();
  const keywords = tokenize(query);
  if (!keywords.length) return [];

  const scored = docs
    .map(d => ({ doc: d, score: scoreText(d.content, keywords) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored.map(s => s.doc);
}

/** ←← 念押しで “デフォルトエクスポート” も同梱（名前付きの取りこぼし対策） */
export default { searchKnowledge, loadKnowledge };
