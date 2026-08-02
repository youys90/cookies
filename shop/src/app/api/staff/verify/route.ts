// 특수 카테고리 비밀번호 검증 API
// - body: { categoryId: number, password: string }
// - categories.access_password_hash 와 scrypt 검증
// - 성공 시 기존 unlock 목록에 이 categoryId 추가한 새 세션 발급

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import {
  COOKIE_NAME,
  SESSION_TTL_SEC,
  issueSessionValue,
  parseSessionValue,
} from "@/lib/staff-session";
import { verifyPassword } from "@/lib/category-password";

export const runtime = "nodejs";

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  { auth: { persistSession: false } },
);

export async function POST(req: Request) {
  if (!process.env.STAFF_SESSION_SECRET) {
    return NextResponse.json({ ok: false, reason: "server_misconfig" }, { status: 500 });
  }

  let body: { categoryId?: number; password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const categoryId = Number(body.categoryId);
  const submitted = String(body.password || "");
  if (!Number.isInteger(categoryId) || categoryId <= 0 || !submitted) {
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const { data: cat } = await supa
    .from("categories")
    .select("id, is_special, access_password_hash, is_active")
    .eq("id", categoryId)
    .maybeSingle();

  if (!cat || !cat.is_active || !cat.is_special || !cat.access_password_hash) {
    return NextResponse.json({ ok: false, reason: "not_special" }, { status: 404 });
  }

  if (!verifyPassword(submitted, cat.access_password_hash)) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 401 });
  }

  // 성공 - 기존 세션 있으면 unlock 목록에 추가, 없으면 이 id만
  const cookieStore = await cookies();
  const existing = cookieStore.get(COOKIE_NAME)?.value;
  const prev = parseSessionValue(existing);
  const nextIds = new Set(prev?.unlockedIds || []);
  nextIds.add(categoryId);

  const value = issueSessionValue([...nextIds]);
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
