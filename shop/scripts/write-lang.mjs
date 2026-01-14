import fs from 'fs';

const content = `"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Language = "ja" | "ko";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  formatPrice: (price: number) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations: Record<Language, Record<string, string>> = {
  ja: {
    "nav.home": "HOME",
    "nav.necklace": "ネックレス",
    "nav.earrings": "ピアス",
    "nav.rings": "リング",
    "nav.bracelet": "ブレスレット",
    "nav.search": "検索",
    "nav.cart": "カート",
    "category.all": "すべて",
    "category.accessory": "アクセサリー",
    "category.hair": "ヘアアクセサリー",
    "category.winter": "冬物アイテム",
    "category.keyring": "キーリング",
    "category.eyewear": "メガネ／サングラス",
    "category.fashion": "ファッション雑貨",
    "category.etc": "その他（ETC）",
    "category.staffOnly": "➡ Premium High-Quality ✨",
    "subcat.all": "すべて",
    "subcat.earrings": "ピアス",
    "subcat.necklace": "ネックレス",
    "subcat.ring": "リング",
    "subcat.bracelet": "ブレスレット",
    "subcat.hairpin": "ヘアピン",
    "subcat.clippin": "クリップピン",
    "subcat.hairband": "ヘアゴム",
    "subcat.headband": "ヘアバンド",
    "subcat.gloves": "手袋",
    "subcat.scarf": "マフラー",
    "subcat.beanie": "ビーニー",
    "subcat.knithat": "ニット帽",
    "subcat.bagkeyring": "バッグキーリング",
    "subcat.charkeyring": "キャラクターキーリング",
    "subcat.strap": "ストラップ",
    "subcat.fashionglass": "ファッション眼鏡",
    "subcat.sunglass": "サングラス",
    "subcat.glasscase": "眼鏡ケース",
    "subcat.pouch": "ポーチ",
    "subcat.minibag": "ミニバッグ",
    "subcat.wallet": "財布",
    "subcat.socks": "靴下",
    "subcat.cap": "キャップ",
    "subcat.season": "シーズン限定",
    "subcat.event": "イベント商品",
    "subcat.test": "テスト商品",
    "subcat.etc": "その他",
    "home.collection": "Cookiesの特別なコレクション",
    "home.noProducts": "登録された商品がありません",
    "home.freeShipping": "送料無料",
    "home.freeShippingDesc": "5万円以上で送料無料",
    "home.quality": "品質保証",
    "home.qualityDesc": "1年間無料A/S",
    "home.gift": "ギフトラッピング",
    "home.giftDesc": "無料ギフトラッピング",
    "banner.newArrival": "Cookiesの新しいコレクションをご覧ください",
    "banner.sale": "シーズンオフ特別割引",
    "product.sale": "SALE",
    "product.addToCart": "カートに入れる",
    "product.addedToCart": "追加しました！",
    "product.outOfStock": "在庫切れ",
    "product.description": "商品説明",
    "product.quantity": "数量",
    "product.notFound": "商品が見つかりません。",
    "product.deliveryInfo": "5万円以上で送料無料 | 平日14時までのご注文で当日発送",
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
    "order.title": "注文情報",
    "order.name": "お名前",
    "order.namePlaceholder": "お名前を入力してください",
    "order.line": "LINE ID",
    "order.linePlaceholder": "LINE IDを入力してください",
    "order.submit": "注文を確定する",
    "order.success": "ご注文ありがとうございます！",
    "order.successMsg": "LINEで連絡いたします。",
    "order.orderNumber": "注文番号",
    "order.close": "閉じる",
    "order.error": "注文に失敗しました。もう一度お試しください。",
    "footer.about": "会社概要",
    "footer.contact": "お問い合わせ",
    "footer.privacy": "プライバシーポリシー",
    "footer.terms": "利用規約",
    "footer.copyright": "© 2024 Cookies. All rights reserved.",
    "common.loading": "読み込み中...",
    "common.error": "エラーが発生しました",
    "common.cancel": "キャンセル",
    "common.confirm": "確認",
    "common.back": "戻る",
    "staff.title": "➡ Premium High-Quality ✨",
    "staff.description": "アクセスするにはパスワードを入力してください",
    "staff.placeholder": "パスワード",
    "staff.error": "パスワードが正しくありません",
  },
  ko: {
    "nav.home": "HOME",
    "nav.necklace": "목걸이",
    "nav.earrings": "귀걸이",
    "nav.rings": "반지",
    "nav.bracelet": "팔찌",
    "nav.search": "검색",
    "nav.cart": "장바구니",
    "category.all": "전체",
    "category.accessory": "악세사리",
    "category.hair": "헤어",
    "category.winter": "겨울상품",
    "category.keyring": "키링",
    "category.eyewear": "안경/선글라스",
    "category.fashion": "패션잡화",
    "category.etc": "기타",
    "category.staffOnly": "➡ Premium High-Quality ✨",
    "subcat.all": "전체",
    "subcat.earrings": "귀걸이",
    "subcat.necklace": "목걸이",
    "subcat.ring": "반지",
    "subcat.bracelet": "팔찌",
    "subcat.hairpin": "헤어핀",
    "subcat.clippin": "집게핀",
    "subcat.hairband": "머리끈",
    "subcat.headband": "헤어밴드",
    "subcat.gloves": "장갑",
    "subcat.scarf": "머플러",
    "subcat.beanie": "비니",
    "subcat.knithat": "니트모자",
    "subcat.bagkeyring": "가방 키링",
    "subcat.charkeyring": "캐릭터 키링",
    "subcat.strap": "스트랩",
    "subcat.fashionglass": "패션안경",
    "subcat.sunglass": "선글라스",
    "subcat.glasscase": "안경케이스",
    "subcat.pouch": "파우치",
    "subcat.minibag": "미니백",
    "subcat.wallet": "지갑",
    "subcat.socks": "양말",
    "subcat.cap": "캡모자",
    "subcat.season": "시즌 한정",
    "subcat.event": "이벤트 상품",
    "subcat.test": "테스트 상품",
    "subcat.etc": "기타",
    "home.collection": "쿠키즈의 특별한 컬렉션",
    "home.noProducts": "등록된 상품이 없습니다",
    "home.freeShipping": "무료 배송",
    "home.freeShippingDesc": "5만원 이상 무료 배송",
    "home.quality": "품질 보증",
    "home.qualityDesc": "1년 무상 A/S",
    "home.gift": "선물 포장",
    "home.giftDesc": "무료 선물 포장 서비스",
    "banner.newArrival": "쿠키즈의 새로운 컬렉션을 만나보세요",
    "banner.sale": "시즌 오프 특별 할인",
    "product.sale": "SALE",
    "product.addToCart": "장바구니 담기",
    "product.addedToCart": "담기 완료!",
    "product.outOfStock": "품절",
    "product.description": "상품 설명",
    "product.quantity": "수량",
    "product.notFound": "상품을 찾을 수 없습니다.",
    "product.deliveryInfo": "5만원 이상 무료배송 | 평일 오후 2시 이전 주문 시 당일 발송",
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
    "order.title": "주문 정보",
    "order.name": "이름",
    "order.namePlaceholder": "이름을 입력해주세요",
    "order.line": "LINE ID",
    "order.linePlaceholder": "LINE ID를 입력해주세요",
    "order.submit": "주문 확정",
    "order.success": "주문이 완료되었습니다!",
    "order.successMsg": "LINE으로 연락드리겠습니다.",
    "order.orderNumber": "주문번호",
    "order.close": "닫기",
    "order.error": "주문에 실패했습니다. 다시 시도해주세요.",
    "footer.about": "회사 소개",
    "footer.contact": "문의하기",
    "footer.privacy": "개인정보처리방침",
    "footer.terms": "이용약관",
    "footer.copyright": "© 2024 Cookies. All rights reserved.",
    "common.loading": "로딩 중...",
    "common.error": "오류가 발생했습니다",
    "common.cancel": "취소",
    "common.confirm": "확인",
    "common.back": "뒤로가기",
    "staff.title": "➡ Premium High-Quality ✨",
    "staff.description": "접근하려면 비밀번호를 입력하세요",
    "staff.placeholder": "비밀번호",
    "staff.error": "비밀번호가 올바르지 않습니다",
  },
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("ja");
  const [mounted, setMounted] = useState(false);
  const [krwToJpy, setKrwToJpy] = useState<number>(0.11);

  const fetchExchangeRate = async () => {
    const cached = localStorage.getItem("krwToJpyRate");
    const cachedDate = localStorage.getItem("krwToJpyRateDate");
    const today = new Date().toDateString();
    if (cached && cachedDate === today) {
      setKrwToJpy(parseFloat(cached));
      return;
    }
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/KRW");
      const data = await res.json();
      if (data.rates?.JPY) {
        const rate = data.rates.JPY;
        setKrwToJpy(rate);
        localStorage.setItem("krwToJpyRate", String(rate));
        localStorage.setItem("krwToJpyRateDate", today);
      }
    } catch (error) {
      console.error("환율 조회 실패, 기본값 사용:", error);
    }
  };

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("language") as Language;
    if (saved && (saved === "ja" || saved === "ko")) {
      setLanguageState(saved);
    }
    fetchExchangeRate();
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
      const jpyPrice = Math.round(price * krwToJpy);
      return "¥" + jpyPrice.toLocaleString("ja-JP");
    } else {
      return "₩" + price.toLocaleString("ko-KR");
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
`;

fs.writeFileSync('C:/Claude/web-dev/cookies/shop/src/contexts/LanguageContext.tsx', content);
console.log('LanguageContext.tsx 작성 완료');
