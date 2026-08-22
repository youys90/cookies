// 관리자 임시저장 · 다음 메일 스타일
// - 여러 임시저장 목록 관리 (페이지 종류별로)
// - 만료 기한 30일 · 지나면 자동 삭제
// - localStorage 기반 (같은 브라우저 · 같은 관리자)
// - 서버 저장은 향후 확장 (관리자 계정 개념 정립 시)

const STORAGE_KEY = "adm.drafts.v1";
export const RETENTION_DAYS = 30;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

export interface Draft {
  id: string;
  pageKey: string; // 'bulk-new' · 'customize' · 'reviews-import' · 'review-drafts' 등
  pageLabel: string; // 사장님에게 보일 화면 이름
  title: string; // 사장님이 붙인 이름 or 자동 생성
  data: unknown; // 페이지 상태 (직렬화 가능해야 함)
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

interface DraftsFile {
  version: 1;
  drafts: Draft[];
}

function readAll(): DraftsFile {
  if (typeof window === "undefined") return { version: 1, drafts: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, drafts: [] };
    const parsed = JSON.parse(raw) as DraftsFile;
    if (!parsed.drafts) return { version: 1, drafts: [] };
    // 만료 자동 삭제
    const now = Date.now();
    const live = parsed.drafts.filter((d) => (d.expiresAt || 0) > now);
    if (live.length !== parsed.drafts.length) {
      writeAll({ version: 1, drafts: live });
    }
    return { version: 1, drafts: live };
  } catch {
    return { version: 1, drafts: [] };
  }
}

function writeAll(file: DraftsFile): boolean {
  if (typeof window === "undefined") return false;
  try {
    const json = JSON.stringify(file);
    window.localStorage.setItem(STORAGE_KEY, json);
    // 실제로 저장됐는지 검증 (용량 초과/사파리 프라이빗 등)
    const verify = window.localStorage.getItem(STORAGE_KEY);
    return verify === json;
  } catch (e) {
    console.warn("[adminDrafts] save failed:", e);
    return false;
  }
}

/** 새 ID 만들기 · uuid 대신 간단하게 */
function newId(): string {
  return `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 페이지 종류로 필터해서 · 최근 순으로 반환 */
export function listDrafts(pageKey?: string): Draft[] {
  const { drafts } = readAll();
  const arr = pageKey ? drafts.filter((d) => d.pageKey === pageKey) : drafts;
  return arr.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getDraft(id: string): Draft | null {
  const { drafts } = readAll();
  return drafts.find((d) => d.id === id) ?? null;
}

/** 최근 편집 중이던 임시저장 (페이지별 최신 1개) */
export function getLatestDraft(pageKey: string): Draft | null {
  return listDrafts(pageKey)[0] ?? null;
}

/** 저장 · id 없으면 새로 생성 · 있으면 업데이트 · null 반환 = 실패 (용량 초과 등) */
export function upsertDraft(input: {
  id?: string;
  pageKey: string;
  pageLabel: string;
  title?: string;
  data: unknown;
}): Draft | null {
  const now = Date.now();
  const { drafts } = readAll();
  let target: Draft | undefined = input.id ? drafts.find((d) => d.id === input.id) : undefined;
  if (target) {
    target = { ...target, data: input.data, updatedAt: now, expiresAt: now + RETENTION_MS };
    if (input.title) target.title = input.title;
    const next = drafts.map((d) => (d.id === target!.id ? target! : d));
    const ok = writeAll({ version: 1, drafts: next });
    return ok ? target : null;
  }
  const auto = new Date(now).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  target = {
    id: newId(),
    pageKey: input.pageKey,
    pageLabel: input.pageLabel,
    title: input.title || `${input.pageLabel} · ${auto}`,
    data: input.data,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + RETENTION_MS,
  };
  const ok = writeAll({ version: 1, drafts: [target, ...drafts] });
  return ok ? target : null;
}

export function deleteDraft(id: string): void {
  const { drafts } = readAll();
  writeAll({ version: 1, drafts: drafts.filter((d) => d.id !== id) });
}

/** 여러 임시저장 · 일괄 삭제 */
export function deleteManyDrafts(ids: string[]): number {
  if (ids.length === 0) return 0;
  const { drafts } = readAll();
  const idSet = new Set(ids);
  const remaining = drafts.filter((d) => !idSet.has(d.id));
  const removed = drafts.length - remaining.length;
  writeAll({ version: 1, drafts: remaining });
  return removed;
}

export function clearAll(): void {
  writeAll({ version: 1, drafts: [] });
}

export function daysUntilExpire(d: Draft): number {
  const remain = d.expiresAt - Date.now();
  return Math.max(0, Math.ceil(remain / (24 * 60 * 60 * 1000)));
}
