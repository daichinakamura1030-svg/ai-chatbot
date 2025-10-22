// vercel-api/lib/session.ts
// 開発用: サーバレスでは関数再起動で消えます。→ 本番は Upstash/KV に差し替えを。
type Scope = { grantKey: string; ts: number };
const SCOPE = new Map<string, Scope>();      // userId -> scope
const DENY  = new Set<string>();             // userId（スパム）→ 応答停止

const TTL_MS = 1000 * 60 * 30; // 30分

export function setUserScope(userId: string, grantKey: string) {
  SCOPE.set(userId, { grantKey, ts: Date.now() });
}
export function getUserScope(userId: string): string | null {
  const s = SCOPE.get(userId);
  if (!s) return null;
  if (Date.now() - s.ts > TTL_MS) { SCOPE.delete(userId); return null; }
  return s.grantKey;
}
export function clearUserScope(userId: string) {
  SCOPE.delete(userId);
}

export function isDenied(userId: string) { return DENY.has(userId); }
export function denyUser(userId: string) { DENY.add(userId); }
