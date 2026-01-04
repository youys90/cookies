const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://eftuvzzadxxtxzpgfqom.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmdHV2enphZHh4dHh6cGdmcW9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NzU4MjAsImV4cCI6MjA4MTI1MTgyMH0.p-FBw8fjQ7cCuCG0B4Ks5F47GKrizX50DLAPqKZkM38'
);

async function run() {
  // 가격 차등이 있는 옵션 찾기
  const { data: diffOpts } = await supabase
    .from('product_options')
    .select('product_id, option_name, additional_price')
    .neq('additional_price', 0)
    .limit(20);

  if (diffOpts && diffOpts.length > 0) {
    console.log('=== 가격 차등 옵션 발견 ===\n');
    // 해당 상품 정보 가져오기
    const productIds = [...new Set(diffOpts.map(o => o.product_id))];
    const { data: products } = await supabase
      .from('products')
      .select('id, name, name_ko, price')
      .in('id', productIds);

    const prodMap = {};
    products.forEach(p => prodMap[p.id] = p);

    const optsByProduct = {};
    for (const pid of productIds) {
      const { data: allOpts } = await supabase
        .from('product_options')
        .select('option_name, additional_price')
        .eq('product_id', pid)
        .order('sort_order');
      optsByProduct[pid] = allOpts;
    }

    let count = 0;
    for (const pid of productIds) {
      count++;
      const p = prodMap[pid];
      console.log('[' + count + '] ' + p.name);
      console.log('    한글: ' + (p.name_ko || '-'));
      console.log('    기본가: ¥' + p.price);
      optsByProduct[pid].forEach(o => {
        const diff = o.additional_price || 0;
        const sign = diff > 0 ? '+' : '';
        console.log('      - ' + o.option_name + ': ' + sign + diff + '円');
      });
      console.log('');
      if (count >= 5) break;
    }
    return;
  }

  // 가격 차등 없으면 일반 옵션 샘플
  console.log('=== 가격 차등 없음. 일반 옵션 상품 샘플 ===\n');

  const { data: products } = await supabase
    .from('products')
    .select('id, name, name_ko, price')
    .limit(100);

  const productIds = products.map(p => p.id);

  const { data: allOpts } = await supabase
    .from('product_options')
    .select('product_id, option_name, additional_price')
    .in('product_id', productIds);

  const optsByProduct = {};
  allOpts.forEach(o => {
    if (!optsByProduct[o.product_id]) optsByProduct[o.product_id] = [];
    optsByProduct[o.product_id].push(o);
  });

  let count = 0;
  for (const p of products) {
    if (!optsByProduct[p.id]) continue;
    count++;
    console.log('[' + count + '] ' + p.name);
    console.log('    한글: ' + (p.name_ko || '-'));
    console.log('    기본가: ¥' + p.price);
    optsByProduct[p.id].forEach(o => {
      const diff = o.additional_price || 0;
      const sign = diff > 0 ? '+' : '';
      console.log('      - ' + o.option_name + ': ' + sign + diff + '円');
    });
    console.log('');
    if (count >= 5) break;
  }
}

run();
