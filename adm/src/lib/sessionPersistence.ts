// 관리자 임시저장 · 브라우저 새 탭/다른 페이지 이동해도 작업내용 유지
// - sessionStorage 사용 (브라우저 세션 동안 유지 · 창 닫으면 초기화)
// - 사용처: 상품 일괄 등록(bulk-new) · 엑셀 일괄 등록(excel-import)
// - 원칙: 등록 완료 시 clear · 사장님 명시적 「새로 시작」 클릭 시 clear
// - 시리얼라이즈 불가한 것 (File 객체 등)은 저장 대상에서 제외

export const SESSION_KEYS = {
  // 두 화면이 공유하는 세션 사진 풀 (스토리지에 업로드된 URL만 저장 · 재사용 가능)
  IMAGE_POOL: "adm.session.imagePool",
  // 일괄 등록 (bulk-new) · 각 행 · 상품명/가격/카테고리 등 + 업로드 완료된 사진 URL
  BULK_NEW_ROWS: "adm.session.bulkNewRows",
  // 엑셀 일괄 등록 (excel-import) · 파싱된 행 + 매핑된 사진 URL + 옵션
  EXCEL_IMPORT_ROWS: "adm.session.excelImportRows",
  EXCEL_IMPORT_FILENAME: "adm.session.excelImportFileName",
  // 리뷰 일괄 등록 · 세션 사진 풀 (여러 리뷰 카드에서 재사용)
  REVIEW_IMAGE_POOL: "adm.session.reviewImagePool",
} as const;

export function loadSession<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveSession(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // 용량 초과 등 · 실패해도 사용자에게 알림 없이 무시 (기능 자체는 계속 동작)
    console.warn("[sessionPersistence] save failed:", key, e);
  }
}

export function clearSession(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {}
}

/** 여러 키 한 번에 삭제 */
export function clearManySessions(keys: string[]): void {
  keys.forEach(clearSession);
}
