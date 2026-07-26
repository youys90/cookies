// POST /api/ai/csv-map
// 입력 CSV 헤더 배열 → 표준 스키마 헤더로 자동 매핑
// body: { input_headers: string[], target_headers: string[] }
// 결과: { mapping: Record<string, string | null>, notes: string }

import { NextRequest, NextResponse } from "next/server";
import { callClaude, extractJson, hasApiKey } from "@/lib/anthropic";

interface MapResult {
  mapping: Record<string, string | null>;
  notes: string;
}

function heuristicMap(
  inputs: string[],
  targets: string[]
): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[\s_\-]/g, "")
      .replace(/[（(](.+?)[)）]/g, "");

  const synonyms: Record<string, string[]> = {
    name: ["상품명", "제품명", "타이틀", "title", "name"],
    name_ko: ["한글상품명", "한글", "korean", "namekr", "namekorean", "korean name"],
    name_ja: ["일본어상품명", "일본어", "japanese", "namejp", "namejapanese", "japanese name"],
    price: ["가격", "판매가", "price", "amount"],
    original_price: ["정가", "원가", "listprice", "originalprice"],
    category: ["카테고리", "category", "cat"],
    sub_category: ["소분류", "하위카테고리", "subcategory"],
    description: ["설명", "상품설명", "description", "desc"],
    description_ko: ["한글설명", "descriptionko"],
    description_ja: ["일본어설명", "descriptionja"],
    image: ["이미지", "이미지url", "image", "imageurl", "photo"],
    stock: ["재고", "수량", "stock", "qty"],
    is_active: ["활성", "판매중", "active", "isactive", "status"],
  };

  const targetNorm = targets.map((t) => ({ raw: t, norm: normalize(t) }));

  for (const inp of inputs) {
    const nInp = normalize(inp);
    // 1) 정확 일치
    const exact = targetNorm.find((t) => t.norm === nInp);
    if (exact) {
      mapping[inp] = exact.raw;
      continue;
    }
    // 2) 시노님 매칭
    let matched: string | null = null;
    for (const [t, syns] of Object.entries(synonyms)) {
      if (!targets.includes(t)) continue;
      if (syns.some((s) => normalize(s) === nInp || nInp.includes(normalize(s)))) {
        matched = t;
        break;
      }
    }
    mapping[inp] = matched;
  }
  return mapping;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      input_headers: string[];
      target_headers: string[];
    };
    const { input_headers, target_headers } = body;
    if (!Array.isArray(input_headers) || !Array.isArray(target_headers)) {
      return NextResponse.json({ error: "input_headers, target_headers 필수" }, { status: 400 });
    }

    // API 키 없으면 heuristic 매핑 반환 (mock)
    if (!hasApiKey()) {
      const mapping = heuristicMap(input_headers, target_headers);
      return NextResponse.json({
        mock: true,
        result: {
          mapping,
          notes:
            "휴리스틱 매핑 (사전 정의 시노님만 사용). Anthropic API 키 있으면 더 똑똑한 자연어 매핑으로 자동 전환.",
        },
        note: "ANTHROPIC_API_KEY 미설정",
      });
    }

    const system = `당신은 데이터 매핑 어시스턴트입니다.
사용자가 업로드한 CSV의 컬럼명(input)을 표준 스키마 컬럼(target)으로 매핑하세요.
- 정확히 일치하지 않아도 의미가 같으면 매핑 (예: "상품명" → "name_ko")
- 매핑할 수 없으면 null
- 반드시 JSON만 반환:
{
  "mapping": { "입력컬럼": "타겟컬럼 또는 null" },
  "notes": "간단한 매핑 근거 요약"
}`;

    const userText = `입력 컬럼: ${JSON.stringify(input_headers)}
타겟 컬럼: ${JSON.stringify(target_headers)}

위 스키마의 JSON만 반환.`;

    const claude = await callClaude({
      system,
      user: [{ type: "text", text: userText }],
      maxTokens: 1024,
    });

    if (!claude.ok) {
      // 실패 시에도 heuristic fallback
      const mapping = heuristicMap(input_headers, target_headers);
      return NextResponse.json(
        {
          mock: claude.mock,
          error: claude.error,
          result: { mapping, notes: "AI 호출 실패 → 휴리스틱 fallback 사용" },
        },
        { status: 200 }
      );
    }

    const parsed = extractJson<MapResult>(claude.text);
    if (!parsed) {
      const mapping = heuristicMap(input_headers, target_headers);
      return NextResponse.json(
        { mock: false, result: { mapping, notes: "AI JSON 파싱 실패 → 휴리스틱 fallback" } },
        { status: 200 }
      );
    }

    return NextResponse.json({ mock: false, result: parsed });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
