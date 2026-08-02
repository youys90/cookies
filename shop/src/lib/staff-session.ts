// 프리미엄 스태프 세션 유틸 — HMAC 서명 쿠키 + IP 기반 rate limit
// 서버 전용 (Route Handler에서만 import)

import { createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE_NAME = "cookies_staff";
export const SESSION_TTL_SEC = 60 * 60 * 4; // 4시간 유지
const SECRET = process.env.STAFF_SESSION_SECRET || "";

// SECRET이 비어 있으면 '조용한 인증 실패'를 방지하기 위해 즉시 에러를 던진다.
// (issue는 서명 발급, verify는 검증 — 둘 다 SECRET 없으면 사용 불가로 강제)
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

// ── Rate limit (IP 기반 in-memory, 인스턴스별) ────────
// NOTE: Vercel Serverless는 인스턴스가 여러 개 뜰 수 있어 이 카운터는 인스턴스별로 분산된다.
// 프리미엄 페이지 무차별 대입 대비가 필요해지면 Vercel KV / Upstash Redis 기반 IP 카운터로 이관할 것.
const WINDOW_MS = 10 * 60 * 1000; // 10분
const MAX_FAIL = 5;
const MAX_BUCKETS = 10_000; // 메모리 상한 (장기 실행 인스턴스 누수 방지)

type Bucket = { failCount: number; firstFailAt: number; lockedUntil: number };
const buckets = new Map<string, Bucket>();

// 상한 도달 시 만료된 항목을 우선 프루닝, 없으면 오래된 항목부터 제거
function pruneBuckets(now: number): void {
  // 1) 잠금 해제 + 윈도우 만료된 항목 제거
  for (const [ip, b] of buckets) {
    const windowExpired = b.firstFailAt === 0 || now - b.firstFailAt > WINDOW_MS;
    const notLocked = b.lockedUntil <= now;
    if (windowExpired && notLocked) {
      buckets.delete(ip);
    }
  }
  // 2) 여전히 상한 초과 시 삽입 순서상 오래된 항목부터 제거 (Map insertion order)
  if (buckets.size >= MAX_BUCKETS) {
    const removeCount = buckets.size - Math.floor(MAX_BUCKETS * 0.9);
    let removed = 0;
    for (const ip of buckets.keys()) {
      if (removed >= removeCount) break;
      buckets.delete(ip);
      removed += 1;
    }
  }
}

function getBucket(ip: string): Bucket {
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b) {
    if (buckets.size >= MAX_BUCKETS) pruneBuckets(now);
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
