// 매장 화면 커스터마이징 · shop 전용 사본
// (관리자에서 정의한 스키마와 동기화 유지 · 향후 monorepo/공유 패키지로 이동 가능)

export interface ShopUiConfig {
  version: number;
  linkMobileToDesktop: boolean;
  productList: {
    columnsDesktop: number;
    columnsMobile: number;
    gap: number;
    showName: boolean;
    showPrice: boolean;
    showCategory: boolean;
    imageAspect: "square" | "portrait" | "landscape";
    imageBorderRadius: number;
  };
  pagination: {
    options: number[];
    default: number;
  };
  categoryTabs: {
    columnsDesktop: number;
    columnsMobile: number;
    maxRows: number;
  };
  productDetail: {
    thumbColumns: number;
    thumbMaxRows: number;
    thumbSize: number;
    thumbGap: number;
    showBrandCategory: boolean;
    showDescription: boolean;
  };
  mainTop: {
    promoBarEnabled: boolean;
    /** 한/일 이중 언어 · shop에서 language에 따라 선택 노출 */
    promoBarMessages: Array<{ ko: string; ja: string }>;
    hero: {
      title: { ko: string; ja: string };
      body: { ko: string; ja: string };
      footer: { ko: string; ja: string };
      /** 본문 텍스트 박스 배경색 · hex */
      boxBgColor: string;
      /** 본문 텍스트 박스 배경 투명도 · 0(투명)~100(불투명) */
      boxBgOpacity: number;
      /** 텍스트 박스 최대 너비 px */
      boxMaxWidth: number;
      /** 텍스트 박스 안쪽 여백 px */
      boxPadding: number;
      /** 텍스트 박스 모서리 둥글기 px */
      boxRadius: number;
      layout: "single" | "hero-2col" | "hero-3col" | "grid-2x2" | "mosaic-5" | "carousel";
      images: Array<{
        url: string;
        alt: string;
        link: string;
        fit: "cover" | "contain";
      }>;
    };
    benefits: Array<{
      ko: string; ja: string; en: string;
    }>;
    logo: {
      brand: string;
      tagline: { ko: string; ja: string };
    };
  };
  /** 하단바 · 회사 소개 · 운영시간 · 사업자 정보 · (라벨은 고정 · 값만 편집) */
  footer: {
    /** 회사 소개 (일본어) · 개행 그대로 반영 */
    aboutJa: string;
    /** 회사 소개 (한국어) */
    aboutKo: string;
    /** 운영시간 (일본어) */
    hoursJa: string;
    /** 운영시간 (한국어) */
    hoursKo: string;
    /** 휴무 안내 (일본어) */
    closedJa: string;
    /** 휴무 안내 (한국어) */
    closedKo: string;
    /** 대표자명 · 라벨(CEO)은 고정 · 빈 값이면 shop에서 「―」 표시 */
    ceo: string;
    /** 사업자등록번호 · 빈 값이면 「―」 */
    bizNo: string;
    /** 주소 · 빈 값이면 「―」 */
    address: string;
  };
}

// ⚠ 원칙: 현재 shop 실제 화면의 값과 동일하게 유지 (adm/lib/shopUiSchema.ts와 동기화)
export const DEFAULT_CONFIG: ShopUiConfig = {
  version: 1,
  linkMobileToDesktop: true,
  productList: {
    columnsDesktop: 4,
    columnsMobile: 2,
    gap: 32,
    showName: true,
    showPrice: true,
    showCategory: false,
    imageAspect: "square",
    imageBorderRadius: 0,
  },
  pagination: { options: [25, 50, 100], default: 25 },
  categoryTabs: { columnsDesktop: 8, columnsMobile: 4, maxRows: 2 },
  productDetail: {
    thumbColumns: 5,
    thumbMaxRows: 1,
    thumbSize: 64,
    thumbGap: 8,
    showBrandCategory: true,
    showDescription: false,
  },
  mainTop: {
    promoBarEnabled: true,
    promoBarMessages: [
      { ko: "2026 S/S 신제품 출시", ja: "2026 S/S NEW RELEASE" },
      { ko: "2만엔 이상 구매 시 배송비 무료", ja: "2万円以上ご購入で送料無料" },
      { ko: "2만엔 이상 구매 시 통관보장 무료", ja: "2万円以上ご購入で通関保証無料" },
    ],
    hero: {
      title: {
        ko: "온라인 가격 정책 변경 안내",
        ja: "オンライン価格ポリシー変更のお知らせ",
      },
      body: {
        ko: "이용 편의를 위해 **2만엔 이상 구매 시 배송비와 통관보장 비용을 무료**로 제공합니다. 이에 따라 일부 온라인 상품의 판매 가격이 소폭 조정됩니다. 매장에 직접 방문하시는 고객님께는 기존 매장 가격 그대로 판매됩니다.",
        ja: "ご利用の便宜のため、**2万円以上のご購入で送料と通関保証費用を無料**でご提供いたします。これに伴い、一部のオンライン商品の販売価格が若干調整されます。店舗に直接お越しのお客様には、従来通り店舗価格にて販売しております。",
      },
      footer: {
        ko: "항상 감사합니다.",
        ja: "いつもご愛顧いただきありがとうございます.",
      },
      boxBgColor: "#FAF7F0",
      boxBgOpacity: 70,
      boxMaxWidth: 820,
      boxPadding: 44,
      boxRadius: 4,
      layout: "hero-2col",
      images: [
        { url: "/hero-bg.png", alt: "hero main", link: "/?cat=all", fit: "cover" },
        { url: "", alt: "acc", link: "/?cat=acc", fit: "cover" },
        { url: "", alt: "bag", link: "/?cat=bag", fit: "cover" },
      ],
    },
    benefits: [
      { ko: "배송비 무료", ja: "送料無料", en: "FREE SHIPPING" },
      { ko: "통관보장 무료", ja: "通関保証無料", en: "CUSTOMS COVERED" },
    ],
    logo: {
      brand: "CREAM",
      tagline: { ko: "작은 행복", ja: "little happiness" },
    },
  },
  // ⚠ 초기값 = 현재 shop/src/components/Footer.tsx 하드코딩 값과 동일 · 「디폴트 = 지금 보이는 화면」 유지
  footer: {
    aboutJa: "東京から、ときめくアイテムを\nあなたへお届けします。",
    aboutKo: "도쿄에서, 두근거리는 아이템을\n당신에게 전달합니다.",
    hoursJa: "月〜金 10:00 - 18:00",
    hoursKo: "월-금 10:00 - 18:00",
    closedJa: "土日祝 定休",
    closedKo: "주말·공휴일 정기휴무",
    ceo: "",
    bizNo: "",
    address: "",
  },
};

export function mergeWithDefaults(input: unknown): ShopUiConfig {
  const rec = (input && typeof input === "object") ? input as Record<string, unknown> : {};
  const out = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as ShopUiConfig;
  // 최상위 스칼라
  if (typeof rec.linkMobileToDesktop === "boolean") out.linkMobileToDesktop = rec.linkMobileToDesktop;
  const sections = ["productList", "pagination", "categoryTabs", "productDetail"] as const;
  for (const sec of sections) {
    const secVal = rec[sec];
    if (secVal && typeof secVal === "object") {
      const secRec = secVal as Record<string, unknown>;
      const outSec = out[sec] as Record<string, unknown>;
      for (const k of Object.keys(outSec)) {
        if (secRec[k] !== undefined) outSec[k] = secRec[k];
      }
    }
  }
  // mainTop · 한/일 이중 언어 + 히어로/혜택/로고 · 하위 호환 마이그레이션 (string[] → { ko, ja })
  const mt = rec.mainTop as Record<string, unknown> | undefined;
  if (mt && typeof mt === "object") {
    if (typeof mt.promoBarEnabled === "boolean") out.mainTop.promoBarEnabled = mt.promoBarEnabled;
    const raw = mt.promoBarMessages;
    if (Array.isArray(raw)) {
      out.mainTop.promoBarMessages = raw.map((v) => {
        if (typeof v === "string") return { ko: v, ja: v };
        if (v && typeof v === "object") {
          const o = v as Record<string, unknown>;
          return { ko: String(o.ko ?? ""), ja: String(o.ja ?? o.ko ?? "") };
        }
        return { ko: "", ja: "" };
      });
    }
    const pickPair = (v: unknown, fb: { ko: string; ja: string }): { ko: string; ja: string } => {
      if (v && typeof v === "object") {
        const o = v as Record<string, unknown>;
        return { ko: String(o.ko ?? fb.ko), ja: String(o.ja ?? fb.ja) };
      }
      return fb;
    };
    // 히어로
    const hero = mt.hero as Record<string, unknown> | undefined;
    if (hero && typeof hero === "object") {
      out.mainTop.hero = {
        title: pickPair(hero.title, out.mainTop.hero.title),
        body: pickPair(hero.body, out.mainTop.hero.body),
        footer: pickPair(hero.footer, out.mainTop.hero.footer),
        boxBgColor: typeof hero.boxBgColor === "string" ? hero.boxBgColor : out.mainTop.hero.boxBgColor,
        boxBgOpacity: typeof hero.boxBgOpacity === "number" ? hero.boxBgOpacity : out.mainTop.hero.boxBgOpacity,
        boxMaxWidth: typeof hero.boxMaxWidth === "number" ? hero.boxMaxWidth : out.mainTop.hero.boxMaxWidth,
        boxPadding: typeof hero.boxPadding === "number" ? hero.boxPadding : out.mainTop.hero.boxPadding,
        boxRadius: typeof hero.boxRadius === "number" ? hero.boxRadius : out.mainTop.hero.boxRadius,
        layout: (["single", "hero-2col", "hero-3col", "grid-2x2", "mosaic-5", "carousel"] as const).includes(hero.layout as never) ? (hero.layout as typeof out.mainTop.hero.layout) : out.mainTop.hero.layout,
        images: Array.isArray(hero.images) ? (hero.images as Record<string, unknown>[]).map((im) => ({
          url: typeof im.url === "string" ? im.url : "",
          alt: typeof im.alt === "string" ? im.alt : "",
          link: typeof im.link === "string" ? im.link : "",
          fit: im.fit === "contain" ? "contain" : "cover",
        })) : out.mainTop.hero.images,
      };
    }
    // 혜택
    const bens = mt.benefits;
    if (Array.isArray(bens)) {
      out.mainTop.benefits = bens.map((v) => {
        if (v && typeof v === "object") {
          const o = v as Record<string, unknown>;
          return {
            ko: String(o.ko ?? ""),
            ja: String(o.ja ?? o.ko ?? ""),
            en: String(o.en ?? ""),
          };
        }
        return { ko: "", ja: "", en: "" };
      });
    }
    // 로고
    const logo = mt.logo as Record<string, unknown> | undefined;
    if (logo && typeof logo === "object") {
      if (typeof logo.brand === "string") out.mainTop.logo.brand = logo.brand;
      const tag = logo.tagline as Record<string, unknown> | undefined;
      if (tag && typeof tag === "object") {
        out.mainTop.logo.tagline = {
          ko: String(tag.ko ?? out.mainTop.logo.tagline.ko),
          ja: String(tag.ja ?? out.mainTop.logo.tagline.ja),
        };
      }
    }
  }
  // footer · 하단바 · 필드별 방어적 병합 (없으면 default 유지)
  const ft = rec.footer as Record<string, unknown> | undefined;
  if (ft && typeof ft === "object") {
    const keys: Array<keyof ShopUiConfig["footer"]> = [
      "aboutJa", "aboutKo", "hoursJa", "hoursKo", "closedJa", "closedKo", "ceo", "bizNo", "address",
    ];
    for (const k of keys) {
      if (typeof ft[k] === "string") out.footer[k] = ft[k] as string;
    }
  }
  return out;
}
