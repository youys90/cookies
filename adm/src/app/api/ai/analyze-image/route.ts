// POST /api/ai/analyze-image
// 이미지 파일 → 상품 정보 자동 생성 (한/일)
// body: multipart/form-data { image: File, hint?: string }
// 결과: { name_ko, name_ja, category, sub_category, description_ko, description_ja, tags }

import { NextRequest, NextResponse } from "next/server";
import { callClaude, extractJson, hasApiKey } from "@/lib/anthropic";

interface AnalyzeResult {
  name_ko: string;
  name_ja: string;
  category: string;
  sub_category: string;
  description_ko: string;
  description_ja: string;
  tags: string[];
}

const CATEGORIES = [
  "アクセサリー",
  "ヘアアクセサリー",
  "冬物アイテム",
  "キーリング",
  "メガネ／サングラス",
  "ファッション雑貨",
  "その他（ETC）",
  "➡ Premium High-Quality ✨",
];

const MOCK_RESULT: AnalyzeResult = {
  name_ko: "샘플 이어링",
  name_ja: "サンプル ピアス",
  category: "アクセサリー",
  sub_category: "ピアス",
  description_ko:
    "은은한 골드 컬러의 데일리 이어링. 어떤 코디에도 자연스럽게 어울립니다. (mock 응답 — API 키 미설정)",
  description_ja:
    "上品なゴールドカラーのデイリーピアス。どんなコーデにも自然に馴染みます。(mock — APIキー未設定)",
  tags: ["daily", "gold", "sample", "mock"],
};

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("image") as File | null;
    const hint = (form.get("hint") as string) || "";

    if (!file) {
      return NextResponse.json({ error: "image 파일 누락" }, { status: 400 });
    }

    // API 키 없으면 mock
    if (!hasApiKey()) {
      return NextResponse.json({
        mock: true,
        result: MOCK_RESULT,
        note: "ANTHROPIC_API_KEY 미설정 — 개발 mock 응답 반환됨. 실제 사용 시 .env.local에 키 추가하고 서버 재시작.",
      });
    }

    // 이미지 → base64
    const buf = Buffer.from(await file.arrayBuffer());
    const b64 = buf.toString("base64");
    const media_type = file.type || "image/jpeg";

    const system = `당신은 일본향 잡화·주얼리 셀렉트샵의 상품 등록 어시스턴트입니다.
사진을 보고 다음 정보를 JSON으로만 답하세요 (설명 없이).

카테고리는 반드시 다음 중 하나:
${CATEGORIES.map((c) => "- " + c).join("\n")}

반환 JSON 스키마:
{
  "name_ko": "한국어 상품명 (짧게)",
  "name_ja": "일본어 상품명 (짧게)",
  "category": "위 목록 중 하나",
  "sub_category": "세부 종류 (예: ピアス / ネックレス / ミニバッグ 등)",
  "description_ko": "한국어 상품 설명 (2~3문장, 스타일·색상·소재)",
  "description_ja": "일본어 상품 설명 (2~3문장, 자연스러운 일본어)",
  "tags": ["검색용 키워드 5~7개"]
}`;

    const userHint = hint ? `\n\n추가 힌트: ${hint}` : "";

    const claude = await callClaude({
      system,
      user: [
        { type: "image", source: { type: "base64", media_type, data: b64 } },
        {
          type: "text",
          text:
            "이 상품 사진을 분석해서 위 스키마에 맞는 JSON만 반환하세요." + userHint,
        },
      ],
      maxTokens: 1024,
    });

    if (!claude.ok) {
      return NextResponse.json(
        { mock: claude.mock, error: claude.error, result: MOCK_RESULT },
        { status: 500 }
      );
    }

    const parsed = extractJson<AnalyzeResult>(claude.text);
    if (!parsed) {
      return NextResponse.json(
        { mock: false, error: "AI 응답 JSON 파싱 실패", raw: claude.text },
        { status: 500 }
      );
    }

    return NextResponse.json({ mock: false, result: parsed });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
