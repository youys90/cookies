// 세션 상태 조회 - 특정 카테고리 id가 unlock 되었는지 반환
// GET /api/staff/session?categoryId=8  → { ok: true/false, unlockedIds: [...] }
// GET /api/staff/session               → { unlockedIds: [...] }
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, parseSessionValue } from "@/lib/staff-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const jar = await cookies();
  const v = jar.get(COOKIE_NAME)?.value;
  const parsed = parseSessionValue(v);
  const unlockedIds = parsed?.unlockedIds || [];

  const url = new URL(req.url);
  const catIdRaw = url.searchParams.get("categoryId");
  if (catIdRaw) {
    const cid = Number(catIdRaw);
    const ok = Number.isInteger(cid) && cid > 0 && unlockedIds.includes(cid);
    return NextResponse.json({ ok, unlockedIds });
  }
  return NextResponse.json({ unlockedIds });
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
