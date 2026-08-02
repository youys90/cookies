import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Cron job: 주 3회 실행 (화·목·토 01:00 UTC)
// 가짜 리뷰 자동 생성 (Gemini API 연동)
// 실행당 1건, 주간 3건

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
// TODO: RLS 도입 시 서비스 롤로 교체 (SUPABASE_SERVICE_ROLE_KEY 사용).
// 지금은 reviews 테이블에 RLS가 꺼져 있어 anon key로도 INSERT 가능하지만,
// Phase 2에서 RLS를 켜면 anon key로는 조용히 실패하므로 서비스 롤 키 필요.
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const geminiApiKey = process.env.GEMINI_API_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

// 별점 분포: 5점 40%, 4점 40%, 3점 15%, 2점 3%, 1점 2%
function getRandomRating(): number {
  const rand = Math.random() * 100;
  if (rand < 40) return 5;
  if (rand < 80) return 4;
  if (rand < 95) return 3;
  if (rand < 98) return 2;
  return 1;
}

// Gemini API로 LINE 닉네임 생성
async function generateNickname(): Promise<string> {
  const prompt = `あなたは日本のLINEユーザーです。
LINEの表示名（ニックネーム）を1つだけ生成してください。

以下のような実際のLINEユーザーが使う自然なスタイルで：
- 英語の名前: yuki, miki_chan, sakura99, hina.m
- 英語+絵文字: 🌸miki, nana💕, ✨rina✨
- ひらがな/カタカナ: みき, ユイ, なな
- 英単語組み合わせ: sweetbunny, happycat, moonflower
- 創造的なもの: choco.late, ___mii, xoxo.rina

条件：
- 3〜15文字程度
- 女性的な雰囲気
- 絵文字は0〜2個まで
- 「ニックネーム:」などの接頭辞は付けない

ニックネームのみを出力してください:`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 1.2, maxOutputTokens: 50 },
        }),
      }
    );

    if (!response.ok) {
      console.error("Gemini nickname API error:", await response.text());
      return getDefaultNickname();
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!text || text.length > 20) {
      return getDefaultNickname();
    }

    return text;
  } catch (error) {
    console.error("Gemini nickname API 호출 실패:", error);
    return getDefaultNickname();
  }
}

// Gemini 실패 시 기본 닉네임 (랜덤)
function getDefaultNickname(): string {
  const nicknames = [
    "yuki", "miki_chan", "sakura99", "🌸nana", "rina💕",
    "みき", "ユイ", "hina.m", "sweetcat", "✨mai✨",
    "aoi_", "happybunny", "lily77", "さき", "momo.chan"
  ];
  return nicknames[Math.floor(Math.random() * nicknames.length)];
}

// 닉네임 마스킹 (사용자 리뷰와 동일한 방식)
// 4자 이상: 앞 3자 + *** (예: 田中美花 → 田中美***)
// 3자 이하: 마지막 1자만 * (예: 田中美 → 田中*)
function maskNickname(name: string): string {
  if (name.length > 3) {
    return name.slice(0, 3) + "***";
  } else if (name.length > 1) {
    return name.slice(0, -1) + "*";
  }
  return "*";
}

// 최근 발행 리뷰 20건의 첫 문장 조회 → 프롬프트에 다양성 지시용으로 주입
async function getRecentReviewSnippets(): Promise<string[]> {
  const { data } = await supabase
    .from("reviews")
    .select("content")
    .eq("type", "fake")
    .not("content", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data || [])
    .map((r) => (r.content || "").slice(0, 30).trim())
    .filter(Boolean);
}

// 간단한 중복 검사 (앞 20자 완전 일치 or 전체 텍스트 동일)
function isSimilarToExisting(newText: string, existing: string[]): boolean {
  const head = newText.slice(0, 20).trim();
  if (!head) return false;
  return existing.some(
    (e) => e === newText.trim() || (e.length >= 20 && e.slice(0, 20) === head)
  );
}

// Gemini API로 리뷰 내용 생성 (최근 리뷰와 중복 회피 지시 포함)
async function generateReviewContent(rating: number, recent: string[] = []): Promise<string> {
  const ratingContext = rating >= 4
    ? "満足している、良い商品、おすすめ"
    : rating === 3
      ? "普通、まあまあ、期待通り"
      : "少し残念、改善希望、期待はずれ";

  const avoidSection = recent.length > 0
    ? `\n\n【重要】以下は過去に生成された類似リビューの冒頭部分です。**同じ書き出しや同じ表現・同じ言い回しは絶対に避け、まったく違うスタイル・語順・語彙**で書いてください：\n${recent.map((r) => "- 「" + r + "…」").join("\n")}\n`
    : "";

  const prompt = `あなたは日本のジュエリー通販サイトで商品を購入した顧客です。
以下の条件で商品レビューを1つだけ書いてください：
- 評価: ${rating}点（5点満点）
- 感想の傾向: ${ratingContext}
- 文字数: 30〜80文字程度
- 自然な口語体で書く
- 絵文字は使わない
- 「レビュー:」などの接頭辞は付けない
- 商品名は書かない、「アクセサリー」「ジュエリー」「商品」などの一般的な言葉を使う
- 書き出しにバリエーションを付ける（「思っていた〜」「〜プレゼントに」「〜届いてすぐ」「〜デザインが」など毎回変える）
${avoidSection}
レビュー本文のみを出力してください:`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 150,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error("Gemini API error:", await response.text());
      return getDefaultReviewContent(rating);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!text) {
      return getDefaultReviewContent(rating);
    }

    return text;
  } catch (error) {
    console.error("Gemini API 호출 실패:", error);
    return getDefaultReviewContent(rating);
  }
}

// Gemini 실패 시 기본 리뷰 (랜덤)
function getDefaultReviewContent(rating: number): string {
  const positiveReviews = [
    "とても素敵なデザインで気に入りました。友達にもおすすめしたいです。",
    "写真通りの商品で安心しました。また利用したいです。",
    "プレゼント用に購入しましたが、とても喜んでもらえました。",
    "思っていた以上に可愛くて大満足です。",
    "品質が良くて、この価格はお得だと思います。",
  ];

  const neutralReviews = [
    "普通に使えます。特に問題はありません。",
    "期待通りの商品でした。まあまあです。",
    "デザインは好きですが、もう少し高級感があれば良かったです。",
  ];

  const negativeReviews = [
    "少しイメージと違いましたが、使えないことはないです。",
    "もう少し丁寧な梱包を期待していました。",
  ];

  if (rating >= 4) {
    return positiveReviews[Math.floor(Math.random() * positiveReviews.length)];
  } else if (rating === 3) {
    return neutralReviews[Math.floor(Math.random() * neutralReviews.length)];
  } else {
    return negativeReviews[Math.floor(Math.random() * negativeReviews.length)];
  }
}

// 랜덤 상품 1~2개 가져오기 (id, name 포함)
async function getRandomProducts(): Promise<{ ids: number[]; names: string[] } | null> {
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name")
    .eq("is_active", true)
    .limit(100);

  if (error || !products || products.length === 0) {
    console.error("상품 조회 실패:", error);
    return null;
  }

  // 실행당 1개 (cron이 주 3회 화·목·토로 실행 → 주 3개, 판석이형 "일주일에 한두개" 요구 준수)
  const count = 1;
  const shuffled = products.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(count, products.length));

  return {
    ids: selected.map((p) => p.id),
    names: selected.map((p) => p.name),
  };
}

export async function GET(request: Request) {
  try {
    // 인증 검증: Vercel Cron이 보내는 'Authorization: Bearer $CRON_SECRET' 헤더 검증
    // 미일치 시 401 반환 (URL만 알아도 아무나 호출하지 못하도록 차단)
    const authHeader = request.headers.get("authorization");
    const expectedAuth = `Bearer ${process.env.CRON_SECRET || ""}`;
    const isAuthorized =
      !!process.env.CRON_SECRET && authHeader === expectedAuth;

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // URL에서 count 파라미터 추출 (기본값: 1)
    // count는 인증된 관리자/크론 트리거일 때만 허용 (위 인증 통과 후이므로 안전)
    const { searchParams } = new URL(request.url);
    const countParam = searchParams.get("count");
    const dailyCount = countParam ? Math.min(Math.max(1, parseInt(countParam) || 1), 20) : 1;
    let createdCount = 0;
    const errors: string[] = [];

    // 세션 시작 시 최근 리뷰 스니펫 로드 (중복 회피용)
    const recentSnippets = await getRecentReviewSnippets();
    // 이번 실행에서 생성한 것도 다음 리뷰의 회피 목록에 즉시 추가
    const generatedThisRun: string[] = [];

    for (let i = 0; i < dailyCount; i++) {
      const products = await getRandomProducts();
      if (!products) {
        errors.push(`상품 조회 실패 (${i + 1}번째)`);
        continue;
      }

      const rating = getRandomRating();
      const nickname = await generateNickname();

      // 최대 3회 재시도로 중복 회피
      let content = "";
      const combinedAvoid = [...recentSnippets, ...generatedThisRun.map((c) => c.slice(0, 30))];
      for (let attempt = 0; attempt < 3; attempt++) {
        content = await generateReviewContent(rating, combinedAvoid);
        if (!isSimilarToExisting(content, [...recentSnippets, ...generatedThisRun])) break;
      }
      // 3회 시도 후에도 중복이면 이번 건 스킵
      if (isSimilarToExisting(content, [...recentSnippets, ...generatedThisRun])) {
        errors.push(`중복 리뷰로 판단되어 스킵 (${i + 1}번째)`);
        continue;
      }
      generatedThisRun.push(content);

      // 리뷰 삽입 (type: 'fake', ⚠ is_active=false → 관리자 승인 대기)
      const { error: insertError } = await supabase
        .from("reviews")
        .insert({
          product_id: products.ids[0],
          product_ids: products.ids,
          product_names: products.names,
          rating,
          author_name: maskNickname(nickname),
          content,
          images: null,
          type: "fake",
          is_active: false, // 승인 대기 (관리자가 검토 후 노출)
          password: null,
          auto_reply_at: null,
        });

      if (insertError) {
        console.error(`리뷰 생성 실패 (${i + 1}번째):`, insertError);
        errors.push(`리뷰 생성 실패: ${insertError.message}`);
        continue;
      }

      createdCount++;

      // API 호출 간격 조절 (Gemini rate limit 대응)
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const result = {
      message: "Fake reviews cron job completed",
      created: createdCount,
      target: dailyCount,
      errors: errors.length > 0 ? errors : undefined,
    };

    // 실행 로그 기록
    await supabase.from("scheduler_logs").insert({
      job_name: "fake-reviews",
      executed_by: "cron",
      result: result,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Fake reviews cron job error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
