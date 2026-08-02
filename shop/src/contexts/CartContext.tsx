"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface CartItem {
  id: number;
  name: string;
  price: number;
  image: string;
  category: string;
  quantity: number;
  optionId?: number;
  optionName?: string;
  additionalPrice?: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeFromCart: (id: number, optionId?: number) => void;
  updateQuantity: (id: number, quantity: number, optionId?: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // localStorage 파싱 실패(손상된 JSON) 시 앱 크래시 방지
    try {
      const savedCart = localStorage.getItem("cart");
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed)) {
          // 각 아이템 필수 필드 검증 (id/price/quantity 숫자, 그 외 무시)
          const safe = parsed.filter(
            (x): x is CartItem =>
              x &&
              typeof x.id === "number" &&
              typeof x.price === "number" &&
              !Number.isNaN(x.price) &&
              typeof x.quantity === "number" &&
              x.quantity > 0,
          );
          setItems(safe);
        }
      }
    } catch (err) {
      console.warn("CartContext: localStorage 손상, 초기화합니다.", err);
      try {
        localStorage.removeItem("cart");
      } catch { /* ignore */ }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem("cart", JSON.stringify(items));
      } catch (err) {
        // localStorage 용량 초과 등
        console.warn("CartContext: localStorage 저장 실패.", err);
      }
    }
  }, [items, isLoaded]);

  const addToCart = (product: Omit<CartItem, "quantity">, quantity = 1) => {
    // 수량 검증: 정수 · 양수 (1~999 범위)
    const q = Math.floor(Number(quantity));
    if (!Number.isFinite(q) || q < 1) return;
    const safeQty = Math.min(q, 999);
    // 가격 검증: NaN/음수 방어
    if (!Number.isFinite(product.price) || product.price < 0) return;

    setItems((prev) => {
      const existing = prev.find(
        (item) => item.id === product.id && item.optionId === product.optionId
      );
      if (existing) {
        return prev.map((item) =>
          item.id === product.id && item.optionId === product.optionId
            ? { ...item, quantity: Math.min(item.quantity + safeQty, 999) }
            : item
        );
      }
      return [...prev, { ...product, quantity: safeQty }];
    });
  };

  const removeFromCart = (id: number, optionId?: number) => {
    setItems((prev) =>
      prev.filter((item) => !(item.id === id && item.optionId === optionId))
    );
  };

  const updateQuantity = (id: number, quantity: number, optionId?: number) => {
    // 수량 검증: 정수 1~999
    const q = Math.floor(Number(quantity));
    if (!Number.isFinite(q) || q < 1) return;
    const safeQty = Math.min(q, 999);
    setItems((prev) =>
      prev.map((item) =>
        item.id === id && item.optionId === optionId
          ? { ...item, quantity: safeQty }
          : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  // NaN 방어: item.price/additionalPrice가 손상되어도 총액 붕괴 X
  const totalPrice = items.reduce((sum, item) => {
    const p = Number.isFinite(item.price) ? item.price : 0;
    const ap = Number.isFinite(item.additionalPrice) ? Number(item.additionalPrice) : 0;
    const q = Number.isFinite(item.quantity) ? item.quantity : 0;
    return sum + (p + ap) * q;
  }, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
