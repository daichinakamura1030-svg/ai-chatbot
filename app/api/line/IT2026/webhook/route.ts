import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "webhook route exists" });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("LINE webhook received:", JSON.stringify(body, null, 2));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  
}
