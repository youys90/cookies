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

// 랜덤 닉네임 생성 (일본어)
function getRandomNickname(): string {
  const lastNames = ["田中", "山田", "佐藤", "鈴木", "高橋", "渡辺", "伊藤", "中村", "小林", "加藤"];
  const firstChars = ["美", "花", "愛", "優", "真", "陽", "結", "咲", "莉", "彩"];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const firstChar = firstChars[Math.floor(Math.random() * firstChars.length)];
  return `${lastName}${firstChar}`;
}

// 닉네임 마스킹 (田中美 → 田*美)
function maskNickname(name: string): string {
  if (name.length <= 2) return name;
  return name[0] + "*" + name.slice(2);
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

// 랜덤 상품 ID 가져오기
async function getRandomProductId(): Promise<string | null> {
  const { data: products, error } = await supabase
    .from("products")
    .select("id")
    .eq("is_active", true)
    .limit(100);

  if (error || !products || products.length === 0) {
    console.error("상품 조회 실패:", error);
    return null;
  }

  const randomProduct = products[Math.floor(Math.random() * products.length)];
  return randomProduct.id;
}

// 랜덤 이미지 URL (picsum.photos)
function getRandomImageUrl(): string {
  const width = 400;
  const height = 400;
  const randomId = Math.floor(Math.random() * 1000);
  return `https://picsum.photos/seed/${randomId}/${width}/${height}`;
}

export async function GET() {
  try {
    // 하루 생성 개수: 14~15개 (주간 100개 목표)
    const dailyCount = Math.floor(Math.random() * 2) + 14; // 14 or 15
    let createdCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < dailyCount; i++) {
      const productId = await getRandomProductId();
      if (!productId) {
        errors.push(`상품 ID 조회 실패 (${i + 1}번째)`);
        continue;
      }

      const rating = getRandomRating();
      const nickname = getRandomNickname();
      const content = await generateReviewContent(rating);
      const imageUrl = getRandomImageUrl();

      // 리뷰 삽입 (type: 'fake', 모두 공개)
      const { error: insertError } = await supabase
        .from("reviews")
        .insert({
          product_id: productId,
          rating,
          author_name: maskNickname(nickname),
          content,
          images: [imageUrl],
          type: "fake",
          is_active: true,
          password: null, // 가짜 리뷰는 비밀번호 없음
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

    return NextResponse.json({
      message: "Fake reviews cron job completed",
      created: createdCount,
      target: dailyCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Fake reviews cron job error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
