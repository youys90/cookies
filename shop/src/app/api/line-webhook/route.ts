import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import crypto from "node:crypto";

// LINE Webhook signature 검증 · HMAC-SHA256(LINE_CHANNEL_SECRET, rawBody) → Base64
// 반드시 request.text()로 원문 확보 후 검증 · JSON parse 전에 gate 통과 필요
// (P-02 · 2026-09-24 · P-01 조사에서 signature 검증 미구현 확인 · 보안 gate 추가)
function verifyLineSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(signature, "utf8");
  // 길이 다르면 timingSafeEqual이 예외 던짐 · 사전 체크
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

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

// LINE 프로필 조회
async function getLineProfile(userId: string): Promise<string | null> {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!channelAccessToken) return null;

  try {
    const response = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: {
        Authorization: `Bearer ${channelAccessToken}`,
      },
    });
    if (response.ok) {
      const profile = await response.json();
      return profile.displayName || null;
    }
  } catch (error) {
    console.error("프로필 조회 실패:", error);
  }
  return null;
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
    // ─── Signature 검증 gate (P-02) ────────────────────────────
    // 1. Channel Secret 필수 · 없으면 fail-close (fail-open 금지)
    const channelSecret = process.env.LINE_CHANNEL_SECRET;
    if (!channelSecret) {
      // credential 값 로그 X · 미설정 사실만 기록
      console.error("[line-webhook] LINE_CHANNEL_SECRET 미설정 · webhook 처리 거부");
      return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
    }

    // 2. x-line-signature header 없으면 거부
    const signature = request.headers.get("x-line-signature");
    if (!signature) {
      return NextResponse.json({ error: "signature required" }, { status: 401 });
    }

    // 3. 원문 body 확보 (JSON parse 전 · 공백/줄바꿈 원본 그대로 HMAC 대상)
    const rawBody = await request.text();

    // 4. HMAC-SHA256 · Base64 · timingSafeEqual 비교
    if (!verifyLineSignature(rawBody, signature, channelSecret)) {
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }

    // 5. 검증 성공 후에만 JSON parse · 기존 이벤트 로직 진입
    const body: LineWebhookBody = JSON.parse(rawBody);

    for (const event of body.events) {
      if (event.type !== "message" || event.message?.type !== "text") continue;

      const userId = event.source.userId;
      const text = event.message.text.trim();
      const replyToken = event.replyToken;

      if (text === "알림등록") {
        // 이미 등록되어 있는지 확인
        const { data: existing } = await supabase
          .from("line_notify_users")
          .select("id, is_approved")
          .eq("user_id", userId)
          .single();

        if (existing) {
          if (replyToken) {
            if (existing.is_approved) {
              await replyMessage(replyToken, "이미 알림 수신자로 승인되어 있습니다. 주문 알림을 받고 있습니다.");
            } else {
              await replyMessage(replyToken, "이미 신청되어 있습니다. 관리자 승인을 기다려주세요.");
            }
          }
        } else {
          // LINE 프로필에서 이름 가져오기
          const displayName = await getLineProfile(userId);

          // 새로 등록 (승인 대기 상태)
          const { error } = await supabase
            .from("line_notify_users")
            .insert({
              user_id: userId,
              display_name: displayName,
              is_approved: false,
              requested_at: new Date().toISOString()
            });

          if (error) {
            console.error("등록 실패:", error);
            if (replyToken) {
              await replyMessage(replyToken, "등록에 실패했습니다. 다시 시도해주세요.");
            }
          } else {
            if (replyToken) {
              await replyMessage(replyToken, "알림 수신 신청이 완료되었습니다!\n관리자 승인 후 주문 알림을 받을 수 있습니다.");
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
