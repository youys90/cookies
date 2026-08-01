// 스태프 비밀번호 검증 API
// - 서버 env에 저장된 STAFF_PASSWORD와 대조 (클라이언트에 비번 절대 노출 X)
// - IP 기반 rate limit (실패 5회/10분 → 10분 잠금)
// - 성공 시 HMAC 서명된 세션 쿠키 발급 (조작 불가, 4시간)

import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import {
  COOKIE_NAME,
  SESSION_TTL_SEC,
  issueSessionValue,
  isLocked,
  noteFailure,
  clearFailure,
  getClientIp,
} from "@/lib/staff-session";

export const runtime = "nodejs";

function eqConstantTime(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const locked = isLocked(ip);
  if (locked.locked) {
    return NextResponse.json(
      { ok: false, reason: "locked", retryAfterSec: locked.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(locked.retryAfterSec) } },
    );
  }

  const expected = process.env.STAFF_PASSWORD;
  if (!expected) {
    return NextResponse.json({ ok: false, reason: "server_misconfig" }, { status: 500 });
  }

  let body: { password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const submitted = String(body.password || "");
  if (!submitted || !eqConstantTime(submitted, expected)) {
    noteFailure(ip);
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 401 });
  }

  // 성공
  clearFailure(ip);
  const value = issueSessionValue();
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE_NAME,
    value,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });
  return res;
}
