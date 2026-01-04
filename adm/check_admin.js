const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://eftuvzzadxxtxzpgfqom.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmdHV2enphZHh4dHh6cGdmcW9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NzU4MjAsImV4cCI6MjA4MTI1MTgyMH0.p-FBw8fjQ7cCuCG0B4Ks5F47GKrizX50DLAPqKZkM38';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAdmin() {
  try {
    const { data, error } = await supabase
      .from('admin_users')
      .select('*');

    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log('=== Admin Users ===');
    data.forEach((user, idx) => {
      console.log(`\n[${idx + 1}]`);
      console.log(`아이디: ${user.username}`);
      console.log(`비밀번호: ${user.password}`);
      console.log(`이름: ${user.name || '없음'}`);
      console.log(`전화번호: ${user.phone || '없음'}`);
      console.log(`권한: ${user.role || '없음'}`);
    });
  } catch (err) {
    console.error('Exception:', err);
  }
}

checkAdmin();
