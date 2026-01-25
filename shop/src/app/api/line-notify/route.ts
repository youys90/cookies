import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface OrderItem {
  product_name: string;
  quantity: number;
  price: number;
  option_name?: string;
  additional_price?: number;
}

interface NotifyRequest {
  orderNumber: string;
  customerName: string;
  customerLine: string;
  customerPhone: string;
  customerMemo?: string;
  totalPrice: number;
  shippingFee: number;
  items: OrderItem[];
}

export async function POST(request: NextRequest) {
  try {
    const body: NotifyRequest = await request.json();
    const { orderNumber, customerName, customerLine, customerPhone, customerMemo, totalPrice, shippingFee, items } = body;

    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!channelAccessToken) {
      console.error("LINE credentials not configured");
      return NextResponse.json({ success: false, error: "LINE not configured" }, { status: 500 });
    }

    // DB에서 승인된 알림 수신자 목록 조회
    const { data: notifyUsers, error: dbError } = await supabase
      .from("line_notify_users")
      .select("user_id")
      .eq("is_approved", true);

    if (dbError) {
      console.error("DB error:", dbError);
      return NextResponse.json({ success: false, error: "DB error" }, { status: 500 });
    }

    if (!notifyUsers || notifyUsers.length === 0) {
      console.log("No notify users registered");
      return NextResponse.json({ success: true, message: "No users to notify" });
    }

    // 주문 상품 목록 텍스트 생성
    const itemsList = items
      .map((item) => {
        const itemPrice = item.price + (item.additional_price || 0);
        const optionText = item.option_name ? ` (${item.option_name})` : "";
        return `・${item.product_name}${optionText} x${item.quantity} - ₩${itemPrice.toLocaleString()}`;
      })
      .join("\n");

    // LINE 메시지 내용
    const message = `🛒 새 주문이 들어왔습니다!

📦 주문번호: ${orderNumber}
👤 고객명: ${customerName}
💬 LINE ID: ${customerLine}
📞 전화번호: ${customerPhone}${customerMemo ? `\n📋 요청사항: ${customerMemo}` : ""}

📝 주문 상품:
${itemsList}

💰 상품금액: ₩${totalPrice.toLocaleString()}
🚚 배송비: ${shippingFee === 0 ? "무료" : `₩${shippingFee.toLocaleString()}`}
💳 총 결제금액: ₩${(totalPrice + shippingFee).toLocaleString()}`;

    // 모든 수신자에게 메시지 전송
    const sendPromises = notifyUsers.map(async (user) => {
      const response = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${channelAccessToken}`,
        },
        body: JSON.stringify({
          to: user.user_id,
          messages: [{ type: "text", text: message }],
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`LINE API error for user ${user.user_id}:`, errorData);
      }

      return response.ok;
    });

    await Promise.all(sendPromises);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("LINE notify error:", error);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
