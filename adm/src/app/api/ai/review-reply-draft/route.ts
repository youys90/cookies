// POST /api/ai/review-reply-draft
// 리뷰 텍스트/별점 → 답변 초안 3안 (친절 / 간결 / 판촉)
// body: { rating: number, content: string, product_name?: string, language?: "ja"|"ko" }
// 결과: { drafts: [{ tone, text }] }

import { NextRequest, NextResponse } from "next/server";
import { callClaude, extractJson, hasApiKey } from "@/lib/anthropic";

interface DraftResult {
  drafts: { tone: "friendly" | "concise" | "promotional"; text: string }[];
}

const MOCK_JA: DraftResult = {
  drafts: [
    {
      tone: "friendly",
      text: "この度は素敵なレビューをありがとうございます！お気に召していただけて嬉しいです。またのご利用をお待ちしております🙇‍♀️ (mock)",
    },
    {
      tone: "concise",
      text: "レビューありがとうございます。今後もご期待に添えるよう努めます。 (mock)",
    },
    {
      tone: "promotional",
      text: "レビュー感謝いたします！新作アイテムも続々入荷中ですので、ぜひまた覗いてみてくださいね ✨ (mock)",
    },
  ],
};

const MOCK_KO: DraftResult = {
  drafts: [
    {
      tone: "friendly",
      text: "소중한 후기 남겨주셔서 정말 감사드립니다! 마음에 드셨다니 저희도 기뻐요. 또 방문해 주세요 🙇‍♀️ (mock)",
    },
    {
      tone: "concise",
      text: "후기 감사합니다. 앞으로도 좋은 상품으로 보답하겠습니다. (mock)",
    },
    {
      tone: "promotional",
      text: "따뜻한 리뷰 감사드려요! 새로운 상품도 계속 업데이트되니 종종 놀러 오세요 ✨ (mock)",
    },
  ],
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      rating?: number;
      content: string;
      product_name?: string;
      language?: "ja" | "ko";
    };
    const { rating = 5, content, product_name, language = "ja" } = body;

    if (!content) {
      return NextResponse.json({ error: "content 필수" }, { status: 400 });
    }

    if (!hasApiKey()) {
      return NextResponse.json({
        mock: true,
        result: language === "ko" ? MOCK_KO : MOCK_JA,
        note: "ANTHROPIC_API_KEY 미설정 — mock 응답",
      });
    }

    const langLabel = language === "ko" ? "한국어" : "일본어(です・ます調)";
    const system = `당신은 일본향 셀렉트샵의 고객 응대 담당자입니다.
리뷰 별점과 내용을 보고 관리자가 사용할 답변 초안 3가지를 ${langLabel}로 작성하세요.

톤:
1. friendly: 친절하고 정중, 이모지 1~2개 허용
2. concise: 짧고 담백, 이모지 없음
3. promotional: 다음 방문 유도, 이모지 허용

낮은 별점(≤3)이면 사과·개선 의지 포함. 반드시 아래 JSON만 반환:
{
  "drafts": [
    { "tone": "friendly", "text": "..." },
    { "tone": "concise", "text": "..." },
    { "tone": "promotional", "text": "..." }
  ]
}`;

    const userText = `상품명: ${product_name || "-"}
별점: ${rating}
리뷰 내용: ${content}

위 JSON만 반환.`;

    const claude = await callClaude({
      system,
      user: [{ type: "text", text: userText }],
      maxTokens: 1024,
    });

    if (!claude.ok) {
      return NextResponse.json(
        {
          mock: claude.mock,
          error: claude.error,
          result: language === "ko" ? MOCK_KO : MOCK_JA,
        },
        { status: 200 }
      );
    }

    const parsed = extractJson<DraftResult>(claude.text);
    if (!parsed || !Array.isArray(parsed.drafts)) {
      return NextResponse.json(
        {
          mock: false,
          error: "AI JSON 파싱 실패",
          result: language === "ko" ? MOCK_KO : MOCK_JA,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ mock: false, result: parsed });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
