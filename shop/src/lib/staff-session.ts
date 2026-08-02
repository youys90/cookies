// 특수 카테고리 세션 유틸 - HMAC 서명 쿠키 (server-only)
// payload: `${exp}|${unlockedIds}` (unlockedIds = 콤마 구분, 없으면 빈)
// 예: 1704067200|8,15  → 1704067200 만료, 카테고리 id 8, 15 잠금 해제
//
// 4시간 유효, 클라이언트 조작 불가 (HMAC 검증)

import { createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE_NAME = "cookies_staff";
export const SESSION_TTL_SEC = 60 * 60 * 4; // 4시간
const SECRET = process.env.STAFF_SESSION_SECRET || "";

function assertSecret(): void {
  if (!SECRET) throw new Error("STAFF_SESSION_SECRET is not set.");
}

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

export type SessionPayload = {
  exp: number;          // unix seconds
  unlockedIds: number[]; // 잠금 해제된 카테고리 id 목록
};

export function issueSessionValue(unlockedIds: number[]): string {
  assertSecret();
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
  const ids = [...new Set(unlockedIds)].filter((n) => Number.isInteger(n) && n > 0).sort((a, b) => a - b);
  const payload = `${exp}|${ids.join(",")}`;
  return `${payload}.${sign(payload)}`;
}

export function parseSessionValue(v: string | undefined | null): SessionPayload | null {
  assertSecret();
  if (!v) return null;
  const dotIdx = v.lastIndexOf(".");
  if (dotIdx < 0) return null;
  const payload = v.slice(0, dotIdx);
  const mac = v.slice(dotIdx + 1);
  const expected = sign(payload);
  try {
    const a = Buffer.from(mac, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  const [expStr, idsStr] = payload.split("|");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp * 1000 <= Date.now()) return null;
  const unlockedIds = (idsStr || "").split(",").map((s) => Number(s)).filter((n) => Number.isInteger(n) && n > 0);
  return { exp, unlockedIds };
}

// 특정 카테고리 id가 unlock되었는지 확인
export function isCategoryUnlocked(v: string | undefined | null, categoryId: number): boolean {
  const p = parseSessionValue(v);
  if (!p) return false;
  return p.unlockedIds.includes(categoryId);
}
