-- =============================================================
-- 특수 카테고리 지원 (2026-08-03)
-- 목적: Premium처럼 비밀번호로 잠긴 카테고리를 DB로 관리
--       기존 하드코딩 문자열 매칭("Premium" 포함 등) 제거
-- =============================================================

-- 1) 컬럼 추가
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS is_special boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_password_hash text;

-- 2) 인덱스 (shop 목록 조회 시 필터 성능)
CREATE INDEX IF NOT EXISTS idx_categories_is_special ON categories(is_special) WHERE is_special = true;

-- 3) 검증 뷰
CREATE OR REPLACE VIEW v_special_categories AS
SELECT id, name_ja, name_ko, name_en, is_special,
  CASE WHEN access_password_hash IS NULL THEN '❌ 미설정' ELSE '✅ 설정됨' END AS pw_status
FROM categories
WHERE is_special = true OR name_ja LIKE '%Premium%' OR name_ja LIKE '%プレミアム%';
