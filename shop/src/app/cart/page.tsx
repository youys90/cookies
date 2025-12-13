"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { products } from "@/data/products";

// 더미 장바구니 데이터
const initialCart = [
  { productId: 1, quantity: 1 },
  { productId: 3, quantity: 2 },
];

export default function CartPage() {
  const [cartItems, setCartItems] = useState(initialCart);

  const formatPrice = (price: number) => {
    return price.toLocaleString("ko-KR") + "원";
  };

  const getProduct = (productId: number) => {
    return products.find((p) => p.id === productId);
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item
      )
    );
  };

  const removeItem = (productId: number) => {
    setCartItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const totalPrice = cartItems.reduce((sum, item) => {
    const product = getProduct(item.productId);
    return sum + (product?.price || 0) * item.quantity;
  }, 0);

  const shippingFee = totalPrice >= 50000 ? 0 : 3000;

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
        <p className="text-gray-500 mb-6">장바구니가 비어있습니다</p>
        <Link
          href="/"
          className="px-6 py-3 bg-gray-900 text-white text-sm tracking-wide hover:bg-gray-800"
        >
          쇼핑 계속하기
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-2xl font-light tracking-widest text-gray-900 mb-8">CART</h1>

      <div className="grid lg:grid-cols-3 gap-12">
        {/* Cart Items */}
        <div className="lg:col-span-2">
          <div className="border-b border-gray-200 pb-4 mb-4">
            <div className="grid grid-cols-12 text-xs text-gray-500 tracking-wide">
              <div className="col-span-6">상품정보</div>
              <div className="col-span-2 text-center">수량</div>
              <div className="col-span-3 text-right">금액</div>
              <div className="col-span-1"></div>
            </div>
          </div>

          {cartItems.map((item) => {
            const product = getProduct(item.productId);
            if (!product) return null;

            return (
              <div key={item.productId} className="grid grid-cols-12 items-center py-6 border-b border-gray-100">
                {/* Product Info */}
                <div className="col-span-6 flex items-center space-x-4">
                  <div className="relative w-20 h-20 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">{product.category}</p>
                    <Link href={`/product/${product.id}`} className="text-sm font-medium text-gray-900 hover:text-gray-600">
                      {product.name}
                    </Link>
                    <p className="text-sm text-gray-500 mt-1">{formatPrice(product.price)}</p>
                  </div>
                </div>

                {/* Quantity */}
                <div className="col-span-2 flex justify-center">
                  <div className="flex items-center border border-gray-200 rounded">
                    <button
                      onClick={() => updateQuantity(item.productId, -1)}
                      className="px-2 py-1 text-gray-600 hover:bg-gray-50 text-sm"
                    >
                      -
                    </button>
                    <span className="px-3 py-1 text-sm">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.productId, 1)}
                      className="px-2 py-1 text-gray-600 hover:bg-gray-50 text-sm"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Price */}
                <div className="col-span-3 text-right">
                  <span className="text-sm font-medium text-gray-900">
                    {formatPrice(product.price * item.quantity)}
                  </span>
                </div>

                {/* Remove */}
                <div className="col-span-1 text-right">
                  <button
                    onClick={() => removeItem(item.productId)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-gray-50 rounded-lg p-6 sticky top-24">
            <h2 className="text-sm font-medium text-gray-900 tracking-wide mb-6">주문 요약</h2>

            <div className="space-y-4 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>상품 금액</span>
                <span>{formatPrice(totalPrice)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>배송비</span>
                <span>{shippingFee === 0 ? "무료" : formatPrice(shippingFee)}</span>
              </div>
              {shippingFee > 0 && (
                <p className="text-xs text-gray-400">
                  {formatPrice(50000 - totalPrice)} 더 구매 시 무료배송
                </p>
              )}
              <div className="border-t border-gray-200 pt-4 flex justify-between font-medium text-gray-900">
                <span>총 결제 금액</span>
                <span>{formatPrice(totalPrice + shippingFee)}</span>
              </div>
            </div>

            <button className="w-full mt-6 bg-gray-900 text-white py-4 text-sm tracking-wide hover:bg-gray-800 transition-colors">
              주문하기
            </button>

            <Link
              href="/"
              className="block w-full mt-3 text-center py-3 border border-gray-200 text-gray-600 text-sm hover:border-gray-400 transition-colors"
            >
              쇼핑 계속하기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
