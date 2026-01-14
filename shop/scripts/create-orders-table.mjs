// orders 테이블 생성 스크립트 (개발 DB: cookies-dev)
import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: 'aws-1-ap-northeast-2.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.eftuvzzadxxtxzpgfqom',
  password: 'cookies12#$',
  ssl: { rejectUnauthorized: false }
});

const createTableSQL = `
-- 주문 테이블
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number VARCHAR(20) NOT NULL UNIQUE,
  customer_name VARCHAR(100) NOT NULL,
  customer_line VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  total_price INTEGER NOT NULL,
  shipping_fee INTEGER DEFAULT 0,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 주문 상품 테이블
CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  product_name VARCHAR(500) NOT NULL,
  product_image VARCHAR(1000),
  option_name VARCHAR(200),
  price INTEGER NOT NULL,
  additional_price INTEGER DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- 코멘트
COMMENT ON TABLE orders IS '주문 정보';
COMMENT ON COLUMN orders.order_number IS '주문번호';
COMMENT ON COLUMN orders.customer_name IS '고객명';
COMMENT ON COLUMN orders.customer_line IS 'LINE ID';
COMMENT ON COLUMN orders.status IS '주문상태: pending/confirmed/completed/cancelled';
COMMENT ON TABLE order_items IS '주문 상품 목록';
COMMENT ON COLUMN order_items.product_name IS '주문 시점 상품명 스냅샷';
`;

const rlsPolicySQL = `
-- RLS 활성화
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있으면)
DROP POLICY IF EXISTS "Anyone can create orders" ON orders;
DROP POLICY IF EXISTS "Anyone can create order items" ON order_items;
DROP POLICY IF EXISTS "Anyone can view orders" ON orders;
DROP POLICY IF EXISTS "Anyone can view order items" ON order_items;
DROP POLICY IF EXISTS "Anyone can update orders" ON orders;

-- 정책 생성
CREATE POLICY "Anyone can create orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can create order items" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Anyone can view order items" ON order_items FOR SELECT USING (true);
CREATE POLICY "Anyone can update orders" ON orders FOR UPDATE USING (true);
`;

async function main() {
  try {
    await client.connect();
    console.log('개발 DB 연결 성공');

    console.log('테이블 생성 중...');
    await client.query(createTableSQL);
    console.log('테이블 생성 완료');

    console.log('RLS 정책 설정 중...');
    await client.query(rlsPolicySQL);
    console.log('RLS 정책 설정 완료');

    // 확인
    const result = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('orders', 'order_items')
    `);
    console.log('생성된 테이블:', result.rows.map(r => r.table_name));

  } catch (err) {
    console.error('에러:', err.message);
  } finally {
    await client.end();
  }
}

main();
