// 세션 유효성 확인 (프리미엄 접근 이미 인증됐는지)
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, verifySessionValue } from "@/lib/staff-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  const v = jar.get(COOKIE_NAME)?.value;
  const ok = verifySessionValue(v);
  return NextResponse.json({ ok });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
