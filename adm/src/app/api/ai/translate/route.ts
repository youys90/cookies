// 한국어 ↔ 일본어 번역 API
// - Anthropic Claude 사용 (adm/lib/anthropic.ts 재사용)
// - API 키 없으면 mock (원문 반환 + 안내)
// - 짧은 카테고리/상품명 번역에 최적화

import { NextResponse } from "next/server";
import { callClaude, hasApiKey } from "@/lib/anthropic";

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
  if (from === to) return NextResponse.json({ ok: true, translated: text, mock: false });

  if (!hasApiKey()) {
    // mock: 원문 그대로 + 안내 (사장님이 수동 입력 필요)
    return NextResponse.json({
      ok: true,
      translated: text,
      mock: true,
      hint: "ANTHROPIC_API_KEY 미설정 - 실제 번역이 필요합니다. 임시로 원문을 반환했습니다.",
    });
  }

  const langLabel = { ko: "한국어", ja: "일본어(自然な日本語)" };
  const system =
    "당신은 쇼핑몰 브랜드 CREAM의 한/일 번역가입니다. 카테고리명·상품명·짧은 문구를 자연스럽게 번역합니다. " +
    "규칙: 1) 부가 설명 없이 번역 결과만 출력 2) 브랜드명(CHANEL, DIOR 등)은 원문 유지 " +
    "3) 이모지/특수기호는 유지 4) 따옴표·마침표 등 추가 금지 5) 결과는 한 줄로.";

  const prompt = `${langLabel[from]}: "${text}"\n\n위 문구를 ${langLabel[to]}로 번역:`;

  const r = await callClaude({
    system,
    user: [{ type: "text", text: prompt }],
    maxTokens: 300,
  });

  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.error, mock: r.mock }, { status: 502 });
  }

  const translated = r.text.trim().replace(/^["'「『]|["'」』]$/g, "").trim();
  return NextResponse.json({ ok: true, translated, mock: r.mock });
}
