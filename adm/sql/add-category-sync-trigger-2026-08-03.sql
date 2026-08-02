-- =============================================================
-- categories.parent_id 변경 시 products.category_id 자동 동기화 (2026-08-03)
-- 목적: 사장님이 adm에서 하위 카테고리 이동 시 그 산하 상품들이 자동으로 새 상위로 따라감
--       shop은 category_id로만 필터해도 항상 정확
--
-- 트리거 3종:
--   1) categories UPDATE parent_id → products.category_id 재정렬
--   2) categories DELETE → products.category_id/sub_category_id 정리 (FK ON DELETE SET NULL이 처리)
--   3) products의 sub_category_id 변경 시 category_id도 그 하위의 parent_id로 자동 셋
-- =============================================================

-- 1) categories.parent_id 변경 시 관련 products.category_id 자동 갱신
CREATE OR REPLACE FUNCTION sync_products_on_category_move() RETURNS TRIGGER AS $$
BEGIN
  -- 하위 카테고리(parent_id NOT NULL)의 parent_id가 바뀐 경우
  IF NEW.parent_id IS DISTINCT FROM OLD.parent_id AND NEW.parent_id IS NOT NULL THEN
    UPDATE products
    SET category_id = NEW.parent_id
    WHERE sub_category_id = NEW.id
      AND category_id IS DISTINCT FROM NEW.parent_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_products_on_category_move ON categories;
CREATE TRIGGER trg_sync_products_on_category_move
  AFTER UPDATE OF parent_id ON categories
  FOR EACH ROW EXECUTE FUNCTION sync_products_on_category_move();

-- 2) products.sub_category_id INSERT/UPDATE 시 그 하위의 parent_id로 category_id 자동 셋
CREATE OR REPLACE FUNCTION sync_product_category_from_sub() RETURNS TRIGGER AS $$
DECLARE
  parent bigint;
BEGIN
  IF NEW.sub_category_id IS NOT NULL THEN
    SELECT parent_id INTO parent FROM categories WHERE id = NEW.sub_category_id;
    IF parent IS NOT NULL THEN
      NEW.category_id := parent;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_product_category_from_sub ON products;
CREATE TRIGGER trg_sync_product_category_from_sub
  BEFORE INSERT OR UPDATE OF sub_category_id ON products
  FOR EACH ROW EXECUTE FUNCTION sync_product_category_from_sub();
