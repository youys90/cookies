// 매장(shop) 화면 커스터마이징 · 스키마 기반 정의
// 새 항목 추가 방법:
// 1) DEFAULT_CONFIG에 필드 추가 (기본값 필수)
// 2) 아래 SHOP_UI_SCHEMA의 해당 섹션 fields 배열에 FieldMeta 추가
// 3) shop 소비자 (shop/src/contexts/ShopUiContext + 컴포넌트) 에서 새 필드 사용
// 이렇게 하면 관리자 화면의 편집 폼은 자동 렌더링됩니다.

export interface ShopUiConfig {
  version: number; // 스키마 버전 · 향후 마이그레이션 시 사용
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
}

// ⚠ 원칙: 현재 shop 실제 화면의 값과 동일하게 유지
// 개발자가 shop 코드를 수정하면 · 아래 DEFAULT_CONFIG도 함께 갱신해서 「디폴트 = 지금 보이는 화면」 상태 유지
export const DEFAULT_CONFIG: ShopUiConfig = {
  version: 1,
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
};

// ── 스키마 메타 · 편집 UI 자동 생성용 ─────────────────
export interface FieldMeta {
  key: string; // config[section][key]
  label: string;
  hint?: string;
  type: "number" | "boolean" | "select" | "numberList" | "range";
  options?: Array<{ label: string; value: string | number }>;
  min?: number;
  max?: number;
  step?: number;
  count?: number; // numberList 항목 개수 (예: 페이지네이션 옵션 3개)
  suffix?: string; // px, 개 등 표시용
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
      { key: "columnsDesktop", label: "PC 한 줄에 몇 개?", type: "select", options: [
        { label: "2개", value: 2 }, { label: "3개", value: 3 }, { label: "4개", value: 4 },
      ]},
      { key: "columnsMobile", label: "모바일 한 줄에 몇 개?", type: "select", options: [
        { label: "1개", value: 1 }, { label: "2개", value: 2 }, { label: "3개", value: 3 },
      ]},
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
      { key: "columnsDesktop", label: "PC 한 줄에 몇 개?", type: "select", options: [
        { label: "4개", value: 4 }, { label: "5개", value: 5 }, { label: "6개", value: 6 }, { label: "7개", value: 7 },
      ]},
      { key: "columnsMobile", label: "모바일 한 줄에 몇 개?", type: "select", options: [
        { label: "3개", value: 3 }, { label: "4개", value: 4 }, { label: "5개", value: 5 },
      ]},
      { key: "maxRows", label: "최대 줄 수", type: "select", options: [
        { label: "1줄 (넘치면 가로 스크롤)", value: 1 },
        { label: "2줄까지", value: 2 },
        { label: "3줄까지", value: 3 },
      ]},
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
