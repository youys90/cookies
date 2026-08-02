// 카테고리 비밀번호 해싱 API (서버 전용)
// - adm 카테고리 등록/수정 폼에서 호출
// - 평문은 서버에서만 처리 · DB엔 scrypt 해시만 저장

import { NextResponse } from "next/server";
import { randomBytes, scryptSync } from "node:crypto";

export const runtime = "nodejs";

const N = 16384;
const KEYLEN = 64;

function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, KEYLEN, { N });
  return `scrypt$${N}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function POST(req: Request) {
  let body: { password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const pw = String(body.password || "");
  if (!pw || pw.length < 3) {
    return NextResponse.json({ error: "password_too_short" }, { status: 400 });
  }
  if (pw.length > 128) {
    return NextResponse.json({ error: "password_too_long" }, { status: 400 });
  }
  const hash = hashPassword(pw);
  return NextResponse.json({ hash });
}
