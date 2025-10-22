// vercel-api/pages/api/search.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { searchKnowledge } from "../../lib/knowledge";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const q = (req.query.q as string) || "";
  if (!q) return res.status(400).json({ error: "q is required" });

  const hits = await searchKnowledge(q, 3);
  res.status(200).json({
    query: q,
    hits: hits.map(h => ({ source: h.source, preview: h.content.slice(0, 400) + "..." })),
  });
}
