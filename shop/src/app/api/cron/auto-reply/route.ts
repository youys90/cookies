import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Cron job: 1분마다 실행되어 자동 댓글 처리
// 별점 1~3점 리뷰에 대해 예약된 시간이 지나면 사과 댓글 등록

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 자동 댓글 내용 (일본어)
const AUTO_REPLY_MESSAGE = `ご不便をおかけして誠に申し訳ございません。
お客様からいただいたご意見を大切に確認いたしました。問題解決とサービス改善のために最善を尽くしてまいります。
貴重なご意見をいただき、ありがとうございます。`;

export async function GET(request: Request) {
  // Vercel Cron 인증 확인
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date().toISOString();

    // auto_reply_at이 현재 시간보다 이전이고, 아직 댓글이 없는 리뷰 조회
    const { data: reviews, error: fetchError } = await supabase
      .from("reviews")
      .select("id, auto_reply_at")
      .lte("auto_reply_at", now)
      .not("auto_reply_at", "is", null);

    if (fetchError) {
      console.error("리뷰 조회 실패:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!reviews || reviews.length === 0) {
      return NextResponse.json({ message: "No pending replies", processed: 0 });
    }

    let processedCount = 0;

    for (const review of reviews) {
      // 이미 댓글이 있는지 확인
      const { data: existingReply } = await supabase
        .from("review_replies")
        .select("id")
        .eq("review_id", review.id)
        .single();

      if (existingReply) {
        // 이미 댓글이 있으면 auto_reply_at 초기화
        await supabase
          .from("reviews")
          .update({ auto_reply_at: null })
          .eq("id", review.id);
        continue;
      }

      // 댓글 등록
      const { error: insertError } = await supabase
        .from("review_replies")
        .insert({
          review_id: review.id,
          content: AUTO_REPLY_MESSAGE,
          author_name: "Cookies",
        });

      if (insertError) {
        console.error(`댓글 등록 실패 (review_id: ${review.id}):`, insertError);
        continue;
      }

      // auto_reply_at 초기화 (처리 완료)
      await supabase
        .from("reviews")
        .update({ auto_reply_at: null })
        .eq("id", review.id);

      processedCount++;
    }

    return NextResponse.json({
      message: "Auto-reply processed",
      processed: processedCount,
      total: reviews.length,
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
