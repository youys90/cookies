-- 다중 이미지 기능을 위한 DB 변경
-- 실행 환경: Supabase SQL Editor

-- 1. products 테이블에 images 컬럼 추가 (JSONB 배열)
-- 형식: ["url1", "url2", "url3", ...] - 첫 번째가 메인 이미지
ALTER TABLE products
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- 2. 컬럼 설명 추가
COMMENT ON COLUMN products.images IS '상품 이미지 URL 배열 (첫 번째가 메인)';

-- 3. 기존 image 컬럼 값을 images 배열에 마이그레이션 (선택)
-- 기존 상품들의 단일 이미지를 배열로 변환
UPDATE products
SET images = jsonb_build_array(image)
WHERE image IS NOT NULL
  AND image != ''
  AND (images IS NULL OR images = '[]'::jsonb);
