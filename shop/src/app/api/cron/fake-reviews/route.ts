import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Cron job: 하루 1회 실행
// 가짜 리뷰 자동 생성 (Gemini API 연동)
// 주간 100개 목표 → 하루 약 14~15개

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
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

// Gemini API로 리뷰 내용 생성
async function generateReviewContent(rating: number): Promise<string> {
  const ratingContext = rating >= 4
    ? "満足している、良い商品、おすすめ"
    : rating === 3
      ? "普通、まあまあ、期待通り"
      : "少し残念、改善希望、期待はずれ";

  const prompt = `あなたは日本のジュエリー通販サイトで商品を購入した顧客です。
以下の条件で商品レビューを1つだけ書いてください：
- 評価: ${rating}点（5点満点）
- 感想の傾向: ${ratingContext}
- 文字数: 30〜80文字程度
- 自然な口語体で書く
- 絵文字は使わない
- 「レビュー:」などの接頭辞は付けない
- 商品名は書かない、「アクセサリー」「ジュエリー」「商品」などの一般的な言葉を使う

レビュー本文のみを出力してください:`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
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

  // 1~2개 랜덤 선택
  const count = Math.random() < 0.5 ? 1 : 2;
  const shuffled = products.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(count, products.length));

  return {
    ids: selected.map((p) => p.id),
    names: selected.map((p) => p.name),
  };
}

export async function GET(request: Request) {
  try {
    // URL에서 count 파라미터 추출 (기본값: 1)
    const { searchParams } = new URL(request.url);
    const countParam = searchParams.get("count");
    const dailyCount = countParam ? Math.min(Math.max(1, parseInt(countParam) || 1), 20) : 1;
    let createdCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < dailyCount; i++) {
      const products = await getRandomProducts();
      if (!products) {
        errors.push(`상품 조회 실패 (${i + 1}번째)`);
        continue;
      }

      const rating = getRandomRating();
      const nickname = await generateNickname();
      const content = await generateReviewContent(rating);

      // 리뷰 삽입 (type: 'fake', 모두 공개, 사진 없음, 상품 해시태그 포함)
      const { error: insertError } = await supabase
        .from("reviews")
        .insert({
          product_id: products.ids[0], // 첫 번째 상품 (기존 호환성)
          product_ids: products.ids, // 전체 상품 ID 배열
          product_names: products.names, // 상품명 배열 (해시태그용)
          rating,
          author_name: maskNickname(nickname),
          content,
          images: null, // AI 리뷰는 사진 없음
          type: "fake",
          is_active: true,
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
