// 프리미엄 스태프 세션 유틸 — HMAC 서명 쿠키 + IP 기반 rate limit
// 서버 전용 (Route Handler에서만 import)

import { createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE_NAME = "cookies_staff";
export const SESSION_TTL_SEC = 60 * 60 * 4; // 4시간 유지
const SECRET = process.env.STAFF_SESSION_SECRET || "";

// ── 서명 ────────────────────────────────────────────
function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

export function issueSessionValue(): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
  const payload = String(exp);
  return `${payload}.${sign(payload)}`;
}

export function verifySessionValue(v: string | undefined | null): boolean {
  if (!v || !SECRET) return false;
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

// ── Rate limit (IP 기반 in-memory, 인스턴스별) ────────
const WINDOW_MS = 10 * 60 * 1000; // 10분
const MAX_FAIL = 5;

type Bucket = { failCount: number; firstFailAt: number; lockedUntil: number };
const buckets = new Map<string, Bucket>();

function getBucket(ip: string): Bucket {
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b) {
    b = { failCount: 0, firstFailAt: 0, lockedUntil: 0 };
    buckets.set(ip, b);
  }
  // 윈도우 지나면 카운트 초기화
  if (b.firstFailAt && now - b.firstFailAt > WINDOW_MS && now > b.lockedUntil) {
    b.failCount = 0;
    b.firstFailAt = 0;
  }
  return b;
}

export function isLocked(ip: string): { locked: boolean; retryAfterSec: number } {
  const b = getBucket(ip);
  const now = Date.now();
  if (b.lockedUntil > now) {
    return { locked: true, retryAfterSec: Math.ceil((b.lockedUntil - now) / 1000) };
  }
  return { locked: false, retryAfterSec: 0 };
}

export function noteFailure(ip: string) {
  const b = getBucket(ip);
  const now = Date.now();
  if (!b.firstFailAt) b.firstFailAt = now;
  b.failCount += 1;
  if (b.failCount >= MAX_FAIL) {
    b.lockedUntil = now + WINDOW_MS;
    b.failCount = 0; // 잠금 후 재개할 때 다시 셈
    b.firstFailAt = 0;
  }
}

export function clearFailure(ip: string) {
  buckets.delete(ip);
}

export function getClientIp(req: Request): string {
  const h = req.headers;
  const xf = h.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return h.get("x-real-ip") || "unknown";
}
