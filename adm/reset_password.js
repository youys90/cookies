const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabaseUrl = 'https://eftuvzzadxxtxzpgfqom.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmdHV2enphZHh4dHh6cGdmcW9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NzU4MjAsImV4cCI6MjA4MTI1MTgyMH0.p-FBw8fjQ7cCuCG0B4Ks5F47GKrizX50DLAPqKZkM38';

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetPassword() {
  // 새로 설정할 비밀번호
  const newPassword = 'admin1234';

  try {
    // bcrypt로 해시
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    console.log('새 비밀번호 해시:', hashedPassword);

    // DB 업데이트
    const { error } = await supabase
      .from('admin_users')
      .update({
        password: hashedPassword,
        updated_at: new Date().toISOString()
      })
      .eq('username', 'admin');

    if (error) {
      console.error('업데이트 실패:', error);
      return;
    }

    console.log('\n✅ 비밀번호가 초기화되었습니다!');
    console.log('아이디: admin');
    console.log('비밀번호:', newPassword);

  } catch (err) {
    console.error('오류:', err);
  }
}

resetPassword();
