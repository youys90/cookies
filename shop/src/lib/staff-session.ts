// 프리미엄 스태프 세션 유틸 — HMAC 서명 쿠키 (rate limit 제거)
// 서버 전용 (Route Handler에서만 import)

import { createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE_NAME = "cookies_staff";
export const SESSION_TTL_SEC = 60 * 60 * 4; // 4시간 유지
const SECRET = process.env.STAFF_SESSION_SECRET || "";

// SECRET이 비어 있으면 '조용한 인증 실패'를 방지하기 위해 즉시 에러를 던진다.
function assertSecret(): void {
  if (!SECRET) {
    throw new Error(
      "STAFF_SESSION_SECRET is not set. Configure the env var before using staff session utilities."
    );
  }
}

// ── 서명 ────────────────────────────────────────────
function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

export function issueSessionValue(): string {
  assertSecret();
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
  const payload = String(exp);
  return `${payload}.${sign(payload)}`;
}

export function verifySessionValue(v: string | undefined | null): boolean {
  assertSecret();
  if (!v) return false;
  const parts = v.split(".");
  if (parts.length !== 2) return false;
  const [payload, mac] = parts;
  const expected = sign(payload);
  try {
    const a = Buffer.from(mac, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    if (!timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }
  const exp = Number(payload);
  if (!Number.isFinite(exp)) return false;
  return exp * 1000 > Date.now();
}
