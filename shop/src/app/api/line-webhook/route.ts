import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface LineEvent {
  type: string;
  source: {
    type: string;
    userId: string;
  };
  message?: {
    type: string;
    text: string;
  };
  replyToken?: string;
}

interface LineWebhookBody {
  events: LineEvent[];
}

async function replyMessage(replyToken: string, text: string) {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!channelAccessToken) return;

  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body: LineWebhookBody = await request.json();

    for (const event of body.events) {
      if (event.type !== "message" || event.message?.type !== "text") continue;

      const userId = event.source.userId;
      const text = event.message.text.trim();
      const replyToken = event.replyToken;

      if (text === "알림등록") {
        // 이미 등록되어 있는지 확인
        const { data: existing } = await supabase
          .from("line_notify_users")
          .select("id")
          .eq("user_id", userId)
          .single();

        if (existing) {
          if (replyToken) {
            await replyMessage(replyToken, "이미 알림 수신자로 등록되어 있습니다.");
          }
        } else {
          // 새로 등록
          const { error } = await supabase
            .from("line_notify_users")
            .insert({ user_id: userId });

          if (error) {
            console.error("등록 실패:", error);
            if (replyToken) {
              await replyMessage(replyToken, "등록에 실패했습니다. 다시 시도해주세요.");
            }
          } else {
            if (replyToken) {
              await replyMessage(replyToken, "알림 수신자로 등록되었습니다! 이제 주문이 들어오면 알림을 받습니다.");
            }
          }
        }
      } else if (text === "알림해제") {
        const { error } = await supabase
          .from("line_notify_users")
          .delete()
          .eq("user_id", userId);

        if (error) {
          console.error("해제 실패:", error);
          if (replyToken) {
            await replyMessage(replyToken, "해제에 실패했습니다. 다시 시도해주세요.");
          }
        } else {
          if (replyToken) {
            await replyMessage(replyToken, "알림이 해제되었습니다. 더 이상 주문 알림을 받지 않습니다.");
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// LINE Webhook 검증용 GET
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
