/* community.js — Google 로그인/로그아웃 */

/* UI 상태 전환 */
function updateAuthUI(user) {
  const loggedOut = document.getElementById('logged-out');
  const loggedIn  = document.getElementById('logged-in');
  const avatar    = document.getElementById('user-avatar');
  const userName  = document.getElementById('user-name');

  if (user) {
    loggedOut.style.display = 'none';
    loggedIn.style.display  = 'flex';

    const meta = user.user_metadata || {};
    avatar.src = meta.avatar_url || '';
    avatar.style.display = meta.avatar_url ? 'block' : 'none';
    userName.textContent = meta.full_name || user.email;
  } else {
    loggedOut.style.display = 'flex';
    loggedIn.style.display  = 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  /* 페이지 로드 시 현재 세션 확인 */
  supabaseClient.auth.getSession()
    .then(({ data: { session }, error }) => {
      if (error) console.error('세션 확인 오류:', error);
      updateAuthUI(session?.user ?? null);
    });

  /* OAuth 리다이렉트 후 자동 UI 갱신 */
  supabaseClient.auth.onAuthStateChange((event, session) => {
    updateAuthUI(session?.user ?? null);
  });

  /* Google 로그인 */
  document.getElementById('google-login-btn').addEventListener('click', async () => {
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
      },
    });
    if (error) {
      console.error('로그인 오류:', error);
      alert('로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    }
  });

  /* 로그아웃 */
  document.getElementById('logout-btn').addEventListener('click', async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      console.error('로그아웃 오류:', error);
    } else {
      updateAuthUI(null);
    }
  });
});
