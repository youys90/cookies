import { NextRequest, NextResponse } from "next/server";

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
  totalPrice: number;
  shippingFee: number;
  items: OrderItem[];
}

export async function POST(request: NextRequest) {
  try {
    const body: NotifyRequest = await request.json();
    const { orderNumber, customerName, customerLine, totalPrice, shippingFee, items } = body;

    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const userId = process.env.LINE_USER_ID;

    if (!channelAccessToken || !userId) {
      console.error("LINE credentials not configured");
      return NextResponse.json({ success: false, error: "LINE not configured" }, { status: 500 });
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

📝 주문 상품:
${itemsList}

💰 상품금액: ₩${totalPrice.toLocaleString()}
🚚 배송비: ${shippingFee === 0 ? "무료" : `₩${shippingFee.toLocaleString()}`}
💳 총 결제금액: ₩${(totalPrice + shippingFee).toLocaleString()}`;

    // LINE Messaging API로 푸시 메시지 전송
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: [
          {
            type: "text",
            text: message,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("LINE API error:", errorData);
      return NextResponse.json({ success: false, error: "LINE API error" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("LINE notify error:", error);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
