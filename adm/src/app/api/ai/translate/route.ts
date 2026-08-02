// 한국어 ↔ 일본어 번역 API (사용 중단 · 레거시)
// - 지시 18에 따라 Anthropic Claude 경로 제거, MyMemory + Google 무료 번역으로 통일
// - 현재 categories/products 화면은 client에서 translateKoJa()를 직접 호출하므로
//   이 라우트는 실사용 호출자가 없음 (호환/안전 목적으로만 유지)
// - 신규 코드에서는 fetch('/api/ai/translate') 대신 '@/lib/translate'의 translateKoJa() 사용 권장

import { NextResponse } from "next/server";
import { translateKoJa } from "@/lib/translate";

export const runtime = "nodejs";

interface Body {
  text?: string;
  from?: "ko" | "ja";
  to?: "ko" | "ja";
}

export async function POST(req: Request) {
  let body: Body = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const text = (body.text || "").trim();
  const from = body.from;
  const to = body.to;

  if (!text) return NextResponse.json({ ok: false, error: "text_empty" }, { status: 400 });
  if (from !== "ko" && from !== "ja") return NextResponse.json({ ok: false, error: "invalid_from" }, { status: 400 });
  if (to !== "ko" && to !== "ja") return NextResponse.json({ ok: false, error: "invalid_to" }, { status: 400 });
  if (from === to) return NextResponse.json({ ok: true, translated: text });

  try {
    const translated = await translateKoJa(text, from, to);
    return NextResponse.json({ ok: true, translated });
  } catch (err) {
    console.error("[/api/ai/translate] 번역 실패:", err);
    return NextResponse.json({ ok: false, error: "translate_failed" }, { status: 502 });
  }
}
