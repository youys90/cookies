const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://fazlufuqfqmggmlkvtnn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhemx1ZnVxZnFtZ2dtbGt2dG5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU1NTMwNzMsImV4cCI6MjA1MTEyOTA3M30.FByDwFJDpBOvSZxyp1mKlPNPjhlqxnI-3dG6dSOFuZM'
);

async function check() {
  const { data, error } = await supabase
    .from('products')
    .select('id, name_ja, name_ko, price, original_price, category_ja, description_ja, image')
    .eq('category_ja', '➡ Premium High-Quality ✨')
    .order('id', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('=== Premium High-Quality 상품 목록 (개발 DB) ===');
  console.log('총 상품 수:', data.length);
  console.log('');

  data.forEach((p, i) => {
    console.log('[' + (i+1) + '] ID: ' + p.id);
    console.log('    상품명(JP): ' + p.name_ja);
    console.log('    상품명(KR): ' + p.name_ko);
    console.log('    가격: ' + p.price + ' (정가: ' + (p.original_price || '-') + ')');
    console.log('    이미지: ' + (p.image ? p.image.substring(0, 80) : 'none') + '...');
    console.log('');
  });
}

check();
