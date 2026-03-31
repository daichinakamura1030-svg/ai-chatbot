import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ok: true, path: "/api/line/IT2026/webhook" });
}

export async function POST(req: Request) {
  const body = await req.text();
  console.log("IT2026 webhook received:", body);
  return NextResponse.json({ ok: true });
}
