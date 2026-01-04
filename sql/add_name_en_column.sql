-- 이중 언어(일본어/한글) 지원을 위한 DB 변경
-- 실행 환경: Supabase SQL Editor

-- 1. products 테이블에 name_en 컬럼 추가 (일본어 상품명)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS name_en TEXT;

-- 2. 컬럼 설명 추가
COMMENT ON COLUMN products.name_en IS '상품명 (일본어)';
COMMENT ON COLUMN products.name IS '상품명 (한글)';

-- 3. 인덱스 추가 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_products_name_en ON products(name_en);
