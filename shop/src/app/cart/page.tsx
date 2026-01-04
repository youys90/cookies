"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/contexts/CartContext";
import { useLanguage } from "@/contexts/LanguageContext";

export default function CartPage() {
  const { items, removeFromCart, updateQuantity, totalPrice } = useCart();
  const { language, t, formatPrice } = useLanguage();

  const freeShippingThreshold = language === "ja" ? 50000 : 50000;
  const shippingFeeAmount = language === "ja" ? 500 : 3000;
  const shippingFee = totalPrice >= freeShippingThreshold ? 0 : shippingFeeAmount;

  if (items.length === 0) {
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
            <button className="w-full mt-5 bg-gray-900 text-white py-4 text-sm tracking-wide hover:bg-gray-800 transition-colors min-h-[50px] rounded-lg">
              {t("cart.checkout")}
            </button>
            <Link href="/" className="block w-full mt-3 text-center py-3 border border-gray-200 text-gray-600 text-sm hover:border-gray-400 transition-colors rounded-lg min-h-[44px]">
              {t("cart.continueShopping")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
