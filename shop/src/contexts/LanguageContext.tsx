"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Language = "ja" | "ko";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  formatPrice: (price: number) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// UI 텍스트 번역
const translations: Record<Language, Record<string, string>> = {
  ja: {
    // Header
    "nav.home": "HOME",
    "nav.necklace": "ネックレス",
    "nav.earrings": "ピアス",
    "nav.rings": "リング",
    "nav.bracelet": "ブレスレット",
    "nav.search": "検索",
    "nav.cart": "カート",

    // Category
    "category.all": "すべて",
    "category.necklace": "ネックレス",
    "category.earrings": "ピアス",
    "category.rings": "リング",
    "category.bracelet": "ブレスレット",

    // Home
    "home.collection": "Cookiesの特別なコレクション",
    "home.noProducts": "登録された商品がありません",
    "home.freeShipping": "送料無料",
    "home.freeShippingDesc": "5万円以上で送料無料",
    "home.quality": "品質保証",
    "home.qualityDesc": "1年間無料A/S",
    "home.gift": "ギフトラッピング",
    "home.giftDesc": "無料ギフトラッピング",

    // Banner
    "banner.newArrival": "Cookiesの新しいコレクションをご覧ください",
    "banner.sale": "シーズンオフ特別割引",

    // Product
    "product.sale": "SALE",
    "product.addToCart": "カートに入れる",
    "product.addedToCart": "追加しました！",
    "product.outOfStock": "在庫切れ",
    "product.description": "商品説明",
    "product.quantity": "数量",
    "product.notFound": "商品が見つかりません。",
    "product.deliveryInfo": "5万円以上で送料無料 | 平日14時までのご注文で当日発送",

    // Cart
    "cart.title": "ショッピングカート",
    "cart.empty": "カートは空です",
    "cart.total": "合計",
    "cart.checkout": "注文する",
    "cart.continueShopping": "買い物を続ける",
    "cart.remove": "削除",
    "cart.quantity": "数量",
    "cart.orderSummary": "注文概要",
    "cart.subtotal": "商品金額",
    "cart.shipping": "送料",
    "cart.free": "無料",
    "cart.freeShippingMsg": "あと{amount}で送料無料",
    "cart.totalPayment": "お支払い総額",

    // Footer
    "footer.about": "会社概要",
    "footer.contact": "お問い合わせ",
    "footer.privacy": "プライバシーポリシー",
    "footer.terms": "利用規約",
    "footer.copyright": "© 2024 Cookies. All rights reserved.",

    // Common
    "common.loading": "読み込み中...",
    "common.error": "エラーが発生しました",
  },
  ko: {
    // Header
    "nav.home": "HOME",
    "nav.necklace": "목걸이",
    "nav.earrings": "귀걸이",
    "nav.rings": "반지",
    "nav.bracelet": "팔찌",
    "nav.search": "검색",
    "nav.cart": "장바구니",

    // Category
    "category.all": "전체",
    "category.necklace": "목걸이",
    "category.earrings": "귀걸이",
    "category.rings": "반지",
    "category.bracelet": "팔찌",

    // Home
    "home.collection": "쿠키즈의 특별한 컬렉션",
    "home.noProducts": "등록된 상품이 없습니다",
    "home.freeShipping": "무료 배송",
    "home.freeShippingDesc": "5만원 이상 무료 배송",
    "home.quality": "품질 보증",
    "home.qualityDesc": "1년 무상 A/S",
    "home.gift": "선물 포장",
    "home.giftDesc": "무료 선물 포장 서비스",

    // Banner
    "banner.newArrival": "쿠키즈의 새로운 컬렉션을 만나보세요",
    "banner.sale": "시즌 오프 특별 할인",

    // Product
    "product.sale": "SALE",
    "product.addToCart": "장바구니 담기",
    "product.addedToCart": "담기 완료!",
    "product.outOfStock": "품절",
    "product.description": "상품 설명",
    "product.quantity": "수량",
    "product.notFound": "상품을 찾을 수 없습니다.",
    "product.deliveryInfo": "5만원 이상 무료배송 | 평일 오후 2시 이전 주문 시 당일 발송",

    // Cart
    "cart.title": "장바구니",
    "cart.empty": "장바구니가 비어있습니다",
    "cart.total": "합계",
    "cart.checkout": "주문하기",
    "cart.continueShopping": "쇼핑 계속하기",
    "cart.remove": "삭제",
    "cart.quantity": "수량",
    "cart.orderSummary": "주문 요약",
    "cart.subtotal": "상품 금액",
    "cart.shipping": "배송비",
    "cart.free": "무료",
    "cart.freeShippingMsg": "{amount} 더 구매 시 무료배송",
    "cart.totalPayment": "총 결제 금액",

    // Footer
    "footer.about": "회사 소개",
    "footer.contact": "문의하기",
    "footer.privacy": "개인정보처리방침",
    "footer.terms": "이용약관",
    "footer.copyright": "© 2024 Cookies. All rights reserved.",

    // Common
    "common.loading": "로딩 중...",
    "common.error": "오류가 발생했습니다",
  },
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("ja");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("language") as Language;
    if (saved && (saved === "ja" || saved === "ko")) {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("language", lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  const formatPrice = (price: number): string => {
    if (language === "ja") {
      return `¥${price.toLocaleString("ja-JP")}`;
    } else {
      return `₩${price.toLocaleString("ko-KR")}`;
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, formatPrice }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
