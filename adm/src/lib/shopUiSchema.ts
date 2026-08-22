// 매장(shop) 화면 커스터마이징 · 스키마 기반 정의
// 새 항목 추가 방법:
// 1) DEFAULT_CONFIG에 필드 추가 (기본값 필수)
// 2) 아래 SHOP_UI_SCHEMA의 해당 섹션 fields 배열에 FieldMeta 추가
// 3) shop 소비자 (shop/src/contexts/ShopUiContext + 컴포넌트) 에서 새 필드 사용
// 이렇게 하면 관리자 화면의 편집 폼은 자동 렌더링됩니다.

export interface ShopUiConfig {
  version: number; // 스키마 버전 · 향후 마이그레이션 시 사용
  /** true(기본): 모바일 값을 PC에서 자동 파생 · false: 모바일을 독립 편집 */
  linkMobileToDesktop: boolean;
  productList: {
    columnsDesktop: number; // 2 | 3 | 4
    columnsMobile: number; // 1 | 2 | 3
    gap: number; // px
    showName: boolean;
    showPrice: boolean;
    showCategory: boolean;
    imageAspect: "square" | "portrait" | "landscape";
    imageBorderRadius: number; // px
  };
  pagination: {
    options: number[]; // 3개
    default: number;
  };
  categoryTabs: {
    columnsDesktop: number;
    columnsMobile: number;
    maxRows: number;
  };
  productDetail: {
    thumbColumns: number; // 한 줄에 몇 개
    thumbMaxRows: number; // 최대 몇 줄
    thumbSize: number; // px (한 변)
    thumbGap: number; // px
    showBrandCategory: boolean; // 카테고리 라벨 노출
    showDescription: boolean; // 설명 아코디언 자동 펼침
  };
  /** 메인 화면 · 상단 영역 · 슬림바/히어로/혜택/로고 통합 */
  mainTop: {
    /** 최상단 슬라이드 프로모 문구 · 한/일 이중 언어 · 편집은 한국어 · 저장 시 일본어 자동 번역 */
    promoBarMessages: Array<{ ko: string; ja: string }>;
    /** 슬림바 노출 여부 */
    promoBarEnabled: boolean;
    /** 히어로(공지 배너 오버레이) · 큰 제목 + 본문 + 하단 인사말 + 스타일 */
    hero: {
      title: { ko: string; ja: string };
      body: { ko: string; ja: string };
      footer: { ko: string; ja: string };
      /** 제목 색상 · hex (빈 문자열이면 기본 텍스트 색상) */
      titleColor: string;
      /** 제목 굵게 */
      titleBold: boolean;
      /** 본문 기본 색상 */
      bodyColor: string;
      /** 본문 **강조** 마크다운 부분 색상 (기본: 포인트 색상) */
      bodyAccentColor: string;
      /** 본문 텍스트 박스 배경색 hex */
      boxBgColor: string;
      /** 본문 텍스트 박스 배경 투명도 0~100 */
      boxBgOpacity: number;
      /** 텍스트 박스 최대 너비 px (0 = 자동) */
      boxMaxWidth: number;
      /** 텍스트 박스 안쪽 여백(padding) px */
      boxPadding: number;
      /** 텍스트 박스 모서리 둥글기 px */
      boxRadius: number;
      /** 레이아웃 프리셋 · 이미지 배치 방식 */
      layout: "single" | "hero-2col" | "hero-3col" | "grid-2x2" | "mosaic-5" | "carousel";
      /** 이미지 슬롯 배열 · 개수는 layout에 따라 · 초과분은 무시 · 부족분은 빈 슬롯 */
      images: Array<{
        url: string;
        alt: string;
        /** 클릭 시 이동할 경로 (예: /?cat=bag) · 빈 값이면 링크 없음 */
        link: string;
        /** object-fit · cover(꽉채움) · contain(비율유지) */
        fit: "cover" | "contain";
      }>;
    };
    /** 혜택 강조 슬림바 · 항목 리스트 (라벨/색상/굵게) */
    benefits: Array<{
      ko: string; ja: string; en: string;
      color: string;
      bold: boolean;
    }>;
    /** 로고 · 브랜드 워드마크 + 태그라인 + 색상 */
    logo: {
      brand: string;
      tagline: { ko: string; ja: string };
      brandColor: string;
      taglineColor: string;
    };
  };
}

// ⚠ 원칙: 현재 shop 실제 화면의 값과 동일하게 유지
// 개발자가 shop 코드를 수정하면 · 아래 DEFAULT_CONFIG도 함께 갱신해서 「디폴트 = 지금 보이는 화면」 상태 유지
export const DEFAULT_CONFIG: ShopUiConfig = {
  version: 1,
  linkMobileToDesktop: true,
  productList: {
    // shop/src/app/page.tsx · className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8"
    columnsDesktop: 4,
    columnsMobile: 2,
    gap: 32,
    showName: true,
    showPrice: true,
    showCategory: false,
    imageAspect: "square",
    imageBorderRadius: 0,
  },
  pagination: {
    // shop 원래 PAGE_SIZE_OPTIONS
    options: [25, 50, 100],
    default: 25,
  },
  categoryTabs: {
    // shop 원래 `grid-cols-4 md:grid-cols-8` → 모바일 4 · 데스크 8
    columnsDesktop: 8,
    columnsMobile: 4,
    maxRows: 2,
  },
  productDetail: {
    // shop 원래 · w-16 h-16 (64px) · 최대 5개 · 1줄 · gap-2 (8px)
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
      titleColor: "",
      titleBold: false,
      bodyColor: "",
      bodyAccentColor: "",
      boxBgColor: "#FAF7F0",
      boxBgOpacity: 70,
      boxMaxWidth: 820,
      boxPadding: 44,
      boxRadius: 4,
      // 우리가 설정한 기본 레이아웃/이미지 · 「기본값 되돌리기」 = 이 상태로 복귀
      layout: "hero-2col",
      images: [
        { url: "/hero-bg.png", alt: "hero main", link: "/?cat=all", fit: "cover" },
        { url: "", alt: "acc", link: "/?cat=acc", fit: "cover" },
        { url: "", alt: "bag", link: "/?cat=bag", fit: "cover" },
      ],
    },
    benefits: [
      { ko: "배송비 무료", ja: "送料無料", en: "FREE SHIPPING", color: "", bold: false },
      { ko: "통관보장 무료", ja: "通関保証無料", en: "CUSTOMS COVERED", color: "", bold: false },
    ],
    logo: {
      brand: "CREAM",
      tagline: { ko: "작은 행복", ja: "little happiness" },
      brandColor: "",
      taglineColor: "",
    },
  },
};

// ── 스키마 메타 · 편집 UI 자동 생성용 ─────────────────
export interface FieldMeta {
  key: string; // config[section][key]
  label: string;
  hint?: string;
  type: "number" | "boolean" | "select" | "numberList" | "range" | "counter";
  options?: Array<{ label: string; value: string | number }>;
  min?: number;
  max?: number;
  step?: number;
  count?: number; // numberList 항목 개수 (예: 페이지네이션 옵션 3개)
  suffix?: string; // px, 개 등 표시용
  hidden?: boolean; // UI에 노출 안 함 (자동 파생 필드)
}

// ── PC 값에서 · 모바일 값 자동 계산 ─────
// 원칙: PC를 하나 조정하면 · 모바일도 감각 있는 비율로 함께 이동
export function deriveMobileValues(config: ShopUiConfig): ShopUiConfig {
  const next = JSON.parse(JSON.stringify(config)) as ShopUiConfig;

  // 상품 목록 열 수 · PC 대비 절반 (반올림 · 최소 1 · 최대 3)
  const listD = next.productList.columnsDesktop;
  next.productList.columnsMobile = Math.min(3, Math.max(1, Math.round(listD / 2)));

  // 카테고리 탭 열 수 · PC 대비 절반 (최소 3 · 최대 5)
  const catD = next.categoryTabs.columnsDesktop;
  next.categoryTabs.columnsMobile = Math.min(5, Math.max(3, Math.round(catD / 2)));

  return next;
}

export interface SectionMeta {
  key: string; // config의 섹션 key
  label: string;
  icon: string;
  hint?: string;
  fields: FieldMeta[];
}

export const SHOP_UI_SCHEMA: SectionMeta[] = [
  {
    key: "productList",
    label: "상품 목록 꾸미기",
    icon: "📦",
    hint: "상품 크기 · 표시 정보 · 간격",
    fields: [
      { key: "columnsDesktop", label: "한 줄에 표시할 상품 수", type: "counter", min: 1, max: 20, suffix: "개", hint: "원하는 상품 개수를 직접 입력할 수 있어요." },
      { key: "columnsMobile", label: "모바일 열 수 · 자동", type: "counter", hidden: true, min: 1, max: 20, suffix: "개" },
      { key: "gap", label: "상품 사이 간격", type: "range", min: 0, max: 32, step: 2, suffix: "px" },
      { key: "showName", label: "상품명 표시", type: "boolean" },
      { key: "showPrice", label: "가격 표시", type: "boolean" },
      { key: "showCategory", label: "카테고리 표시", type: "boolean" },
      { key: "imageAspect", label: "사진 비율", type: "select", options: [
        { label: "정사각형 (1:1)", value: "square" },
        { label: "세로형 (4:5)", value: "portrait" },
        { label: "가로형 (4:3)", value: "landscape" },
      ]},
      { key: "imageBorderRadius", label: "사진 모서리 둥글기", type: "range", min: 0, max: 24, step: 2, suffix: "px" },
    ],
  },
  {
    key: "pagination",
    label: "한 페이지 상품 수",
    icon: "📄",
    hint: "한 페이지에 보여줄 상품 개수를 설정할 수 있어요.",
    fields: [
      { key: "options", label: "선택할 개수", type: "numberList", count: 3, min: 1, max: 500,
        hint: "예) 25, 50, 100처럼 원하는 개수를 설정할 수 있어요." },
      { key: "default", label: "처음 표시할 개수", type: "number", min: 1, max: 500 },
    ],
  },
  {
    key: "categoryTabs",
    label: "카테고리 메뉴",
    icon: "🗂️",
    hint: "상품 위에 표시되는 카테고리 메뉴",
    fields: [
      { key: "columnsDesktop", label: "한 줄에 표시할 메뉴 수", type: "counter", min: 1, max: 20, suffix: "개", hint: "원하는 메뉴 개수를 직접 입력할 수 있어요." },
      { key: "columnsMobile", label: "모바일 열 수 · 자동", type: "counter", hidden: true, min: 1, max: 20, suffix: "개" },
      { key: "maxRows", label: "최대 표시 줄 수", type: "counter", min: 1, max: 10, suffix: "줄" },
    ],
  },
  {
    key: "productDetail",
    label: "상세 화면 · 상품 상세 페이지",
    icon: "🖼",
    hint: "고객이 상품 클릭 후 보게 되는 페이지",
    fields: [
      { key: "thumbColumns", label: "썸네일 한 줄에 몇 개?", type: "counter", min: 1, max: 20, suffix: "개" },
      { key: "thumbMaxRows", label: "썸네일 최대 몇 줄?", type: "counter", min: 1, max: 10, suffix: "줄" },
      { key: "thumbSize", label: "썸네일 한 변 크기", type: "range", min: 40, max: 120, step: 4, suffix: "px" },
      { key: "thumbGap", label: "썸네일 사이 간격", type: "range", min: 2, max: 20, step: 2, suffix: "px" },
      { key: "showBrandCategory", label: "브랜드/카테고리 라벨 보이기", type: "boolean" },
      { key: "showDescription", label: "설명 자동으로 펼쳐두기", type: "boolean" },
    ],
  },
];

// ── 방어적 config 병합 · DB 값에 없는 필드는 기본값으로 보완 ─────
export function mergeWithDefaults(input: unknown): ShopUiConfig {
  const rec = (input && typeof input === "object") ? input as Record<string, unknown> : {};
  const out = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as ShopUiConfig;
  for (const sec of SHOP_UI_SCHEMA) {
    const secVal = rec[sec.key];
    if (secVal && typeof secVal === "object") {
      const secRec = secVal as Record<string, unknown>;
      const outSec = out[sec.key as keyof ShopUiConfig] as Record<string, unknown>;
      for (const f of sec.fields) {
        if (secRec[f.key] !== undefined) outSec[f.key] = secRec[f.key];
      }
    }
  }
  // mainTop 은 SHOP_UI_SCHEMA에 편집 폼이 없으므로 별도 병합
  const mt = rec.mainTop as Record<string, unknown> | undefined;
  if (mt && typeof mt === "object") {
    if (typeof mt.promoBarEnabled === "boolean") out.mainTop.promoBarEnabled = mt.promoBarEnabled;
    const raw = mt.promoBarMessages;
    if (Array.isArray(raw)) {
      // 하위 호환: 기존 string[] → { ko, ja } 로 자동 마이그레이션 (같은 값 양쪽에)
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
        titleColor: typeof hero.titleColor === "string" ? hero.titleColor : out.mainTop.hero.titleColor,
        titleBold: typeof hero.titleBold === "boolean" ? hero.titleBold : out.mainTop.hero.titleBold,
        bodyColor: typeof hero.bodyColor === "string" ? hero.bodyColor : out.mainTop.hero.bodyColor,
        bodyAccentColor: typeof hero.bodyAccentColor === "string" ? hero.bodyAccentColor : out.mainTop.hero.bodyAccentColor,
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
            color: typeof o.color === "string" ? o.color : "",
            bold: typeof o.bold === "boolean" ? o.bold : false,
          };
        }
        return { ko: "", ja: "", en: "", color: "", bold: false };
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
      if (typeof logo.brandColor === "string") out.mainTop.logo.brandColor = logo.brandColor;
      if (typeof logo.taglineColor === "string") out.mainTop.logo.taglineColor = logo.taglineColor;
    }
  }
  return out;
}

// 소프트 삭제 후 영구 삭제까지의 유예 일수
export const TRASH_RETENTION_DAYS = 20;
