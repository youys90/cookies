// 매장 화면 커스터마이징 · shop 전용 사본
// (관리자에서 정의한 스키마와 동기화 유지 · 향후 monorepo/공유 패키지로 이동 가능)

export interface ShopUiConfig {
  version: number;
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
}

// ⚠ 원칙: 현재 shop 실제 화면의 값과 동일하게 유지 (adm/lib/shopUiSchema.ts와 동기화)
export const DEFAULT_CONFIG: ShopUiConfig = {
  version: 1,
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
};

export function mergeWithDefaults(input: unknown): ShopUiConfig {
  const rec = (input && typeof input === "object") ? input as Record<string, unknown> : {};
  const out = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as ShopUiConfig;
  const sections = ["productList", "pagination", "categoryTabs"] as const;
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
  return out;
}
