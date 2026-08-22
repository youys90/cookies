-- =============================================================
-- 카테고리 트리거 리팩터 (2026-08-22)
--
-- 문제: 기존 트리거 2개가 products.sub_category_id 기반이었는데,
--       adm 상품 등록/수정 코드는 이 컬럼을 저장 안 함 → 트리거 발화 X
--       → 234건(19%) 상품이 카테고리 이동 무반응 · Premium 132건 포함
--
-- 해결: 트리거 조건을 문자열(category/sub_category) 기반으로 전환
--       + categories 변경 시 products 문자열도 자동 갱신 → 체인으로 id 매핑
--
-- 작동 흐름:
--   [adm] 상품 등록 (category="ACC", sub_category="ピアス")
--     → BEFORE INSERT ON products
--     → sync_product_ids_from_names() 발화
--     → categories 조회해서 category_id, sub_category_id 자동 채움
--
--   [adm] 카테고리 이름 변경 or 이동
--     → AFTER UPDATE OF name_ja/parent_id ON categories
--     → sync_products_on_category_rename() 발화
--     → 관련 products의 category/sub_category 문자열 UPDATE
--     → (체인) BEFORE UPDATE OF category ON products
--     → sync_product_ids_from_names() 발화 → id 자동 갱신
-- =============================================================

-- 1) 기존 트리거·함수 제거 (재설계)
DROP TRIGGER IF EXISTS trg_sync_products_on_category_move ON categories;
DROP TRIGGER IF EXISTS trg_sync_product_category_from_sub ON products;
DROP FUNCTION IF EXISTS sync_products_on_category_move();
DROP FUNCTION IF EXISTS sync_product_category_from_sub();

-- 2) products.category/sub_category (문자열) → id 자동 매핑
CREATE OR REPLACE FUNCTION sync_product_ids_from_names() RETURNS TRIGGER AS $$
DECLARE
  cid bigint;
  sid bigint;
BEGIN
  -- category 문자열 → category_id
  IF NEW.category IS NOT NULL AND NEW.category <> '' THEN
    SELECT id INTO cid FROM categories
    WHERE parent_id IS NULL AND name_ja = NEW.category
    LIMIT 1;
    NEW.category_id := cid;
  ELSE
    NEW.category_id := NULL;
  END IF;

  -- sub_category 문자열 (+category) → sub_category_id
  IF NEW.sub_category IS NOT NULL AND NEW.sub_category <> ''
     AND NEW.category IS NOT NULL AND NEW.category <> '' THEN
    SELECT c.id INTO sid
    FROM categories c
    JOIN categories p ON c.parent_id = p.id
    WHERE p.name_ja = NEW.category AND c.name_ja = NEW.sub_category
    LIMIT 1;
    NEW.sub_category_id := sid;
  ELSE
    NEW.sub_category_id := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_product_ids_from_names
  BEFORE INSERT OR UPDATE OF category, sub_category ON products
  FOR EACH ROW EXECUTE FUNCTION sync_product_ids_from_names();

-- 3) categories.name_ja/parent_id 변경 → 관련 products 문자열 자동 갱신
CREATE OR REPLACE FUNCTION sync_products_on_category_rename() RETURNS TRIGGER AS $$
DECLARE
  old_parent_name text;
  new_parent_name text;
BEGIN
  -- 최상위 카테고리 이름 변경 (parent_id IS NULL)
  IF OLD.parent_id IS NULL AND NEW.parent_id IS NULL
     AND NEW.name_ja IS DISTINCT FROM OLD.name_ja THEN
    -- 이 최상위에 걸린 모든 상품의 category 문자열 갱신
    -- + 하위 카테고리에 걸린 상품도 category 갱신 (상위 이름 변경이니)
    UPDATE products SET category = NEW.name_ja WHERE category = OLD.name_ja;
  END IF;

  -- 하위 카테고리 이름 변경 (parent_id 유지, 이름만 바뀜)
  IF OLD.parent_id IS NOT NULL AND NEW.parent_id = OLD.parent_id
     AND NEW.name_ja IS DISTINCT FROM OLD.name_ja THEN
    SELECT name_ja INTO old_parent_name FROM categories WHERE id = OLD.parent_id;
    UPDATE products SET sub_category = NEW.name_ja
    WHERE sub_category = OLD.name_ja AND category = old_parent_name;
  END IF;

  -- 하위 카테고리 이동 (parent_id 변경) 또는 상위→하위 전환
  IF NEW.parent_id IS DISTINCT FROM OLD.parent_id AND NEW.parent_id IS NOT NULL THEN
    SELECT name_ja INTO new_parent_name FROM categories WHERE id = NEW.parent_id;
    IF OLD.parent_id IS NOT NULL THEN
      SELECT name_ja INTO old_parent_name FROM categories WHERE id = OLD.parent_id;
    ELSE
      old_parent_name := OLD.name_ja; -- 이전엔 최상위였음
    END IF;
    -- 이 하위 카테고리를 sub_category로 가진 상품들의 category를 새 상위로 갱신
    UPDATE products
    SET category = new_parent_name
    WHERE sub_category = NEW.name_ja
      AND (category = old_parent_name OR (OLD.parent_id IS NULL AND category = OLD.name_ja));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_products_on_category_rename
  AFTER UPDATE OF name_ja, parent_id ON categories
  FOR EACH ROW EXECUTE FUNCTION sync_products_on_category_rename();

-- 4) 검증 뷰 (매핑 상태 확인용)
CREATE OR REPLACE VIEW v_products_mapping_status AS
SELECT
  CASE
    WHEN category_id IS NULL AND category IS NOT NULL THEN '❌ category_id 미매핑'
    WHEN category_id IS NULL AND category IS NULL THEN '⚠ category 자체 없음'
    WHEN sub_category IS NOT NULL AND sub_category_id IS NULL THEN '⚠ sub 미매핑'
    ELSE '✅ 정상'
  END AS status,
  count(*) AS 건수
FROM products
WHERE is_active = true
GROUP BY 1
ORDER BY 2 DESC;
