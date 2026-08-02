-- =============================================================
-- products ↔ categories FK 연결 (2026-08-03)
-- 목적: adm 카테고리 관리에서 이동/이름변경 시 shop 상품 매핑 자동 반영
--
-- 실행 순서:
--   1. dev DB에서 이 SQL 실행
--   2. node scripts/backfill-product-category-ids.js dev  (기존 데이터 매핑)
--   3. shop dev 서버 확인
--   4. 이상 없으면 real 브랜치 배포 + prod DB에 동일 SQL/스크립트 실행
--
-- 안전성:
--   - 기존 category / sub_category 문자열 컬럼은 유지 (fallback + 백업)
--   - 신규 컬럼 nullable → 기존 상품 등록/수정 코드 영향 없음
--   - ON DELETE SET NULL → 카테고리 삭제해도 상품은 살아남음
-- =============================================================

-- 1) 컬럼 추가
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category_id     bigint,
  ADD COLUMN IF NOT EXISTS sub_category_id bigint;

-- 2) FK 제약 (ON DELETE SET NULL → 카테고리 지워져도 상품 유지)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_category_id_fkey') THEN
    ALTER TABLE products
      ADD CONSTRAINT products_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_sub_category_id_fkey') THEN
    ALTER TABLE products
      ADD CONSTRAINT products_sub_category_id_fkey
      FOREIGN KEY (sub_category_id) REFERENCES categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3) 조회 인덱스 (shop 홈 카테고리 필터 성능)
CREATE INDEX IF NOT EXISTS idx_products_category_id     ON products(category_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_products_sub_category_id ON products(sub_category_id) WHERE is_active = true;

-- 4) 검증용 뷰 (매핑 결과 확인)
CREATE OR REPLACE VIEW v_products_category_check AS
SELECT
  p.id, p.name_ja,
  p.category      AS legacy_cat_str,
  p.sub_category  AS legacy_sub_str,
  c.name_ja       AS mapped_cat_name,
  s.name_ja       AS mapped_sub_name,
  CASE
    WHEN p.category_id IS NULL THEN '❌ 상위 미매핑'
    WHEN p.sub_category IS NOT NULL AND p.sub_category_id IS NULL THEN '⚠ 하위 미매핑'
    ELSE '✅'
  END AS status
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN categories s ON s.id = p.sub_category_id
WHERE p.is_active = true;

-- 실행 후 확인 쿼리:
-- SELECT status, count(*) FROM v_products_category_check GROUP BY status;
