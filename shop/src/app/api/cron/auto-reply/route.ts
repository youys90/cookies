import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Cron job: 하루 1회 실행
// 1. 별점 1~3점 리뷰에 자동 사과 댓글 등록
// 2. 1~3점 리뷰 중 1주일 지난 것 자동 숨김

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

// 자동 댓글 내용 (일본어)
const AUTO_REPLY_MESSAGE = `ご不便をおかけして誠に申し訳ございません。
お客様からいただいたご意見を大切に確認いたしました。問題解決とサービス改善のために最善を尽くしてまいります。
貴重なご意見をいただき、ありがとうございます。`;

export async function GET() {
  try {
    const now = new Date();
    const nowISO = now.toISOString();

    // === 1. 자동 댓글 처리 ===
    const { data: pendingReplies, error: fetchError } = await supabase
      .from("reviews")
      .select("id, auto_reply_at")
      .lte("auto_reply_at", nowISO)
      .not("auto_reply_at", "is", null);

    let replyProcessedCount = 0;

    if (!fetchError && pendingReplies && pendingReplies.length > 0) {
      for (const review of pendingReplies) {
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

        replyProcessedCount++;
      }
    }

    // === 2. 1주일 지난 1~3점 리뷰 자동 숨김 ===
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: oldLowRatingReviews, error: hideError } = await supabase
      .from("reviews")
      .select("id")
      .eq("is_active", true)
      .eq("type", "user")
      .lte("rating", 3)
      .lte("created_at", oneWeekAgo);

    let hiddenCount = 0;

    if (!hideError && oldLowRatingReviews && oldLowRatingReviews.length > 0) {
      const ids = oldLowRatingReviews.map((r) => r.id);

      const { error: updateError } = await supabase
        .from("reviews")
        .update({ is_active: false })
        .in("id", ids);

      if (!updateError) {
        hiddenCount = ids.length;
      } else {
        console.error("리뷰 숨김 실패:", updateError);
      }
    }

    return NextResponse.json({
      message: "Cron job completed",
      autoReply: {
        processed: replyProcessedCount,
        total: pendingReplies?.length || 0,
      },
      autoHide: {
        hidden: hiddenCount,
      },
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
