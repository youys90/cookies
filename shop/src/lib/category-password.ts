// 카테고리별 비밀번호 해시/검증 유틸 (server-only)
// - Node crypto scrypt 사용 (bcrypt 의존 없이, 별도 npm 설치 불필요)
// - 저장 형식: `scrypt$N$salt(hex)$hash(hex)`
// - 상수 시간 비교 (timingSafeEqual)

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const N = 16384; // scrypt cost
const KEYLEN = 64;

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, KEYLEN, { N });
  return `scrypt$${N}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  if (!Number.isFinite(n) || n < 1024) return false;
  try {
    const salt = Buffer.from(parts[2], "hex");
    const expected = Buffer.from(parts[3], "hex");
    const actual = scryptSync(plain, salt, expected.length, { N: n });
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
