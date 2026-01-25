"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/contexts/CartContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";

export default function CartPage() {
  const { items, removeFromCart, updateQuantity, totalPrice, clearCart } = useCart();
  const { language, t, formatPrice } = useLanguage();

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerLine, setCustomerLine] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerMemo, setCustomerMemo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [error, setError] = useState("");

  // 배송비 정책: EMS 국제배송 30,000원, 10만원 이상 무료배송
  const freeShippingThreshold = 100000;
  const shippingFeeAmount = 30000;
  const shippingFee = totalPrice >= freeShippingThreshold ? 0 : shippingFeeAmount;

  const generateOrderNumber = () => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    return `ORD-${dateStr}-${random}`;
  };

  const handleCheckout = () => {
    setShowOrderModal(true);
    setError("");
  };

  const handleSubmitOrder = async () => {
    if (!customerName.trim() || !customerLine.trim() || !customerPhone.trim()) {
      setError(t("order.error"));
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const newOrderNumber = generateOrderNumber();

      // 주문 생성
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert({
          order_number: newOrderNumber,
          customer_name: customerName.trim(),
          customer_line: customerLine.trim(),
          customer_phone: customerPhone.trim(),
          memo: customerMemo.trim() || null,
          status: "pending",
          total_price: totalPrice,
          shipping_fee: shippingFee,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 주문 상품 생성
      const orderItems = items.map((item) => ({
        order_id: orderData.id,
        product_id: item.id,
        product_name: item.name,
        product_image: item.image,
        option_name: item.optionName || null,
        price: item.price,
        additional_price: item.additionalPrice || 0,
        quantity: item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      setOrderNumber(newOrderNumber);
      setOrderComplete(true);

      // LINE 알림 전송 (실패해도 주문은 완료됨)
      try {
        await fetch("/api/line-notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderNumber: newOrderNumber,
            customerName: customerName.trim(),
            customerLine: customerLine.trim(),
            customerPhone: customerPhone.trim(),
            totalPrice,
            shippingFee,
            items: items.map((item) => ({
              product_name: item.name,
              quantity: item.quantity,
              price: item.price,
              option_name: item.optionName,
              additional_price: item.additionalPrice,
            })),
          }),
        });
      } catch (lineError) {
        console.error("LINE 알림 실패:", lineError);
      }

      clearCart();
    } catch (err) {
      console.error("주문 에러:", err);
      setError(t("order.error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setShowOrderModal(false);
    setOrderComplete(false);
    setCustomerName("");
    setCustomerLine("");
    setCustomerPhone("");
    setCustomerMemo("");
    setError("");
  };

  if (items.length === 0 && !orderComplete) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
        <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
        <p className="text-gray-500 mb-6">{t("cart.empty")}</p>
        <Link href="/" className="px-6 py-3 bg-gray-900 text-white text-sm tracking-wide hover:bg-gray-800 min-h-[44px]">
          {t("cart.continueShopping")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <h1 className="text-xl md:text-2xl font-medium tracking-wide text-gray-900 mb-6 md:mb-8">{t("cart.title")}</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => {
              const itemTotalPrice = item.price + (item.additionalPrice || 0);
              return (
              <div key={`${item.id}-${item.optionId || 'no-option'}`} className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex gap-4">
                  <div className="relative w-20 h-20 md:w-24 md:h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    <Image src={item.image} alt={item.name} fill className="object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 mb-1">{item.category}</p>
                    <Link href={`/products/${item.id}`} className="text-sm md:text-base font-medium text-gray-900 hover:text-gray-600 line-clamp-2">
                      {item.name}
                    </Link>
                    {item.optionName && (
                      <p className="text-xs text-gray-500 mt-1">
                        {item.optionName}
                        {item.additionalPrice && item.additionalPrice > 0 && ` (+${formatPrice(item.additionalPrice)})`}
                      </p>
                    )}
                    <p className="text-sm font-medium text-gray-900 mt-1">{formatPrice(itemTotalPrice)}</p>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border border-gray-200 rounded">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1, item.optionId)} className="px-3 py-2 text-gray-600 hover:bg-gray-50 text-sm min-w-[40px]">-</button>
                        <span className="px-3 py-2 text-sm min-w-[40px] text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1, item.optionId)} className="px-3 py-2 text-gray-600 hover:bg-gray-50 text-sm min-w-[40px]">+</button>
                      </div>
                      <button onClick={() => removeFromCart(item.id, item.optionId)} className="p-2 text-gray-400 hover:text-red-500" aria-label="삭제">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg p-5 shadow-sm sticky top-20">
              <h2 className="text-base font-medium text-gray-900 mb-4">{t("cart.orderSummary")}</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>{t("cart.subtotal")}</span>
                  <span>{formatPrice(totalPrice)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>{t("cart.shipping")}</span>
                  <span>{shippingFee === 0 ? t("cart.free") : formatPrice(shippingFee)}</span>
                </div>
                {shippingFee > 0 && (
                  <p className="text-xs text-gray-400">
                    {t("cart.freeShippingMsg").replace("{amount}", formatPrice(freeShippingThreshold - totalPrice))}
                  </p>
                )}
                <div className="border-t border-gray-100 pt-3 flex justify-between font-medium text-gray-900">
                  <span>{t("cart.totalPayment")}</span>
                  <span className="text-base">{formatPrice(totalPrice + shippingFee)}</span>
                </div>
              </div>
              <button
                onClick={handleCheckout}
                className="w-full mt-5 bg-gray-900 text-white py-4 text-sm tracking-wide hover:bg-gray-800 transition-colors min-h-[50px] rounded-lg"
              >
                {t("cart.checkout")}
              </button>
              <Link href="/" className="block w-full mt-3 text-center py-3 border border-gray-200 text-gray-600 text-sm hover:border-gray-400 transition-colors rounded-lg min-h-[44px]">
                {t("cart.continueShopping")}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 주문 모달 - 모바일 최적화 */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-lg w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            {!orderComplete ? (
              <div className="p-5 sm:p-6">
                {/* 헤더 */}
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-medium text-gray-900">{t("order.title")}</h2>
                  <button onClick={handleCloseModal} className="p-2 -mr-2 text-gray-400 hover:text-gray-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  {/* 이름 - 로마자 입력 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("order.name")}</label>
                    <input
                      type="text"
                      inputMode="latin"
                      autoCapitalize="words"
                      autoComplete="name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder={t("order.namePlaceholder")}
                      className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>

                  {/* LINE ID */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("order.line")}</label>
                    <input
                      type="text"
                      inputMode="text"
                      autoCapitalize="none"
                      autoComplete="off"
                      value={customerLine}
                      onChange={(e) => setCustomerLine(e.target.value)}
                      placeholder={t("order.linePlaceholder")}
                      className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>

                  {/* 전화번호 - 숫자 키패드 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("order.phone")}</label>
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={customerPhone}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9-+]/g, '');
                        setCustomerPhone(value);
                      }}
                      placeholder={t("order.phonePlaceholder")}
                      className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>

                  {/* 요청사항 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("order.memo")}</label>
                    <textarea
                      value={customerMemo}
                      onChange={(e) => setCustomerMemo(e.target.value)}
                      placeholder={t("order.memoPlaceholder")}
                      rows={2}
                      className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
                    />
                  </div>
                </div>

                {/* 안내 문구 */}
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800 flex items-start gap-2">
                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {t("order.notice")}
                  </p>
                </div>

                {error && (
                  <p className="text-red-500 text-sm mt-3">{error}</p>
                )}

                {/* 버튼 - 모바일에서 터치하기 쉬운 크기 */}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleCloseModal}
                    className="flex-1 py-3.5 min-h-[48px] border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 active:bg-gray-100 text-base font-medium"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    onClick={handleSubmitOrder}
                    disabled={isSubmitting}
                    className="flex-1 py-3.5 min-h-[48px] bg-gray-900 text-white rounded-lg hover:bg-gray-800 active:bg-gray-700 disabled:bg-gray-400 text-base font-medium"
                  >
                    {isSubmitting ? t("common.loading") : t("order.submit")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center p-5 sm:p-6">
                <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <h2 className="text-lg font-medium text-gray-900 mb-2">{t("order.success")}</h2>
                <p className="text-gray-600 mb-4">{t("order.successMsg")}</p>
                <p className="text-sm text-gray-500 mb-6">
                  {t("order.orderNumber")}: <span className="font-medium">{orderNumber}</span>
                </p>
                <button
                  onClick={handleCloseModal}
                  className="w-full py-3.5 min-h-[48px] bg-gray-900 text-white rounded-lg hover:bg-gray-800 active:bg-gray-700 text-base font-medium"
                >
                  {t("order.close")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
