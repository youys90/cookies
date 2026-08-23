// PPT식 편집기 · postMessage 타입/상수 스캐폴드 (MVP 1단계 · 미사용)
// - MVP 1단계 · adm 안에서 편집 대상을 UI로 선택 · shop 클릭 후크는 미도입
// - 이후 단계 (요소 hover · 클릭 선택 UX) 확장 시 이 타입을 활용할 예정

export const EDIT_CLICK_TYPE = "cookies:edit-click" as const;

export interface CookiesEditClickRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CookiesEditClick {
  type: typeof EDIT_CLICK_TYPE;
  key: string;
  rect: CookiesEditClickRect;
}

/** 런타임 · 임의의 MessageEvent가 CookiesEditClick 형태인지 안전 판별 */
export function isCookiesEditClick(data: unknown): data is CookiesEditClick {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (d.type !== EDIT_CLICK_TYPE) return false;
  if (typeof d.key !== "string") return false;
  if (!d.rect || typeof d.rect !== "object") return false;
  const r = d.rect as Record<string, unknown>;
  return (
    typeof r.x === "number" &&
    typeof r.y === "number" &&
    typeof r.w === "number" &&
    typeof r.h === "number"
  );
}
