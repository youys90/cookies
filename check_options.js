const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './shop/.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function getOptionSamples() {
  // 옵션이 있는 상품 조회
  const { data, error } = await supabase
    .from('products')
    .select('id, name, name_ko, price, options')
    .not('options', 'is', null)
    .limit(20);

  if (error) {
    console.error('에러:', error);
    return;
  }

  console.log('=== 가격 차등 옵션 상품 샘플 ===\n');

  let count = 0;
  for (const p of data) {
    if (!p.options || p.options.length === 0) continue;

    // 가격 차등이 있는지 확인 (price_diff가 0이 아닌 옵션이 있는 경우)
    const hasPriceDiff = p.options.some(opt => opt.price_diff && opt.price_diff !== 0);
    if (!hasPriceDiff) continue;

    count++;
    console.log(`[${count}] ${p.name}`);
    console.log(`    한글: ${p.name_ko || '-'}`);
    console.log(`    기본가: ¥${p.price}`);
    console.log(`    옵션:`);
    p.options.forEach(opt => {
      const diff = opt.price_diff ? (opt.price_diff > 0 ? `+${opt.price_diff}` : opt.price_diff) : '±0';
      console.log(`      - ${opt.name}: ${diff}円`);
    });
    console.log('');

    if (count >= 5) break;
  }

  if (count === 0) {
    console.log('가격 차등 옵션 상품이 없습니다.');
  }
}

getOptionSamples();
