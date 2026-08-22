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
    label: "상품 목록",
    icon: "📦",
    hint: "상품 카드 크기 · 노출 정보 · 배치",
    fields: [
      { key: "columnsDesktop", label: "한 줄에 몇 개?", type: "counter", min: 1, max: 20, suffix: "개", hint: "모바일은 자동 조정 · 원하는 숫자 직접 입력 가능" },
      { key: "columnsMobile", label: "모바일 열 수 · 자동", type: "counter", hidden: true, min: 1, max: 20, suffix: "개" },
      { key: "gap", label: "카드 사이 여백", type: "range", min: 0, max: 32, step: 2, suffix: "px" },
      { key: "showName", label: "상품명 보이기", type: "boolean" },
      { key: "showPrice", label: "가격 보이기", type: "boolean" },
      { key: "showCategory", label: "카테고리 보이기", type: "boolean" },
      { key: "imageAspect", label: "사진 비율", type: "select", options: [
        { label: "정사각형 (1:1)", value: "square" },
        { label: "세로 (4:5)", value: "portrait" },
        { label: "가로 (4:3)", value: "landscape" },
      ]},
      { key: "imageBorderRadius", label: "사진 모서리 둥글기", type: "range", min: 0, max: 24, step: 2, suffix: "px" },
    ],
  },
  {
    key: "pagination",
    label: "페이지 개수",
    icon: "📄",
    hint: "화면 하단 · 한 페이지에 몇 개 씩 볼지",
    fields: [
      { key: "options", label: "선택지 (3개)", type: "numberList", count: 3, min: 1, max: 500,
        hint: "예) 25, 50, 100 또는 28, 70, 200 · 사장님이 원하는 숫자로" },
      { key: "default", label: "기본값", type: "number", min: 1, max: 500 },
    ],
  },
  {
    key: "categoryTabs",
    label: "카테고리 탭",
    icon: "🗂️",
    hint: "화면 상단의 카테고리 버튼 줄",
    fields: [
      { key: "columnsDesktop", label: "한 줄에 몇 개?", type: "counter", min: 1, max: 20, suffix: "개", hint: "모바일은 자동 조정 · 원하는 숫자 직접 입력 가능" },
      { key: "columnsMobile", label: "모바일 열 수 · 자동", type: "counter", hidden: true, min: 1, max: 20, suffix: "개" },
      { key: "maxRows", label: "최대 줄 수", type: "select", options: [
        { label: "1줄 (넘치면 가로 스크롤)", value: 1 },
        { label: "2줄까지", value: 2 },
        { label: "3줄까지", value: 3 },
      ]},
    ],
  },
  {
    key: "productDetail",
    label: "상세 화면 · 상품 상세 페이지",
    icon: "🖼",
    hint: "고객이 상품 클릭 후 보게 되는 페이지",
    fields: [
      { key: "thumbColumns", label: "썸네일 한 줄에 몇 개?", type: "select", options: [
        { label: "3개", value: 3 }, { label: "4개", value: 4 }, { label: "5개", value: 5 }, { label: "6개", value: 6 }, { label: "8개", value: 8 },
      ]},
      { key: "thumbMaxRows", label: "썸네일 최대 몇 줄?", type: "select", options: [
        { label: "1줄", value: 1 }, { label: "2줄", value: 2 }, { label: "3줄", value: 3 },
      ]},
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
  return out;
}

// 소프트 삭제 후 영구 삭제까지의 유예 일수
export const TRASH_RETENTION_DAYS = 20;
