/* community.js — Google 로그인/로그아웃 + 글 작성/조회/삭제 */

/* ── 전역 상태 ── */
let currentUser   = null;
let currentFilter = 'all';
let allPosts      = [];

/* 카테고리 값 → 한글 */
const CATEGORY_LABELS = {
  intro:  '자기소개',
  prompt: '프롬프트',
  tip:    'AI 활용팁',
  info:   '알게 된 정보',
};

/* 상대 시간 포맷 */
function relativeTime(isoStr) {
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60)            return '방금 전';
  if (diff < 3600)          return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400)         return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 86400 * 2)     return '어제';
  if (diff < 86400 * 30)    return `${Math.floor(diff / 86400)}일 전`;
  const d = new Date(isoStr);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

/* ── 인증 UI 전환 ── */
function updateAuthUI(user) {
  currentUser = user;

  const loggedOut      = document.getElementById('logged-out');
  const loggedIn       = document.getElementById('logged-in');
  const avatar         = document.getElementById('user-avatar');
  const userName       = document.getElementById('user-name');
  const writeCollapsed = document.getElementById('write-collapsed');
  const writeForm      = document.getElementById('write-form');

  if (user) {
    loggedOut.style.display      = 'none';
    loggedIn.style.display       = 'flex';
    writeCollapsed.style.display = 'block';

    const meta = user.user_metadata || {};
    avatar.src             = meta.avatar_url || '';
    avatar.style.display   = meta.avatar_url ? 'block' : 'none';
    userName.textContent   = meta.full_name || user.email;
  } else {
    loggedOut.style.display      = 'flex';
    loggedIn.style.display       = 'none';
    writeCollapsed.style.display = 'none';
    writeForm.style.display      = 'none';
  }
}

/* ── 카테고리 pill 스타일 동기화 ── */
function syncCategoryPills() {
  document.querySelectorAll('.comm-cat-label').forEach(label => {
    const radio = label.querySelector('input[type="radio"]');
    label.classList.toggle('selected', radio.checked);
  });
}

/* ── 글 목록 렌더링 ── */
function renderPosts() {
  const container = document.getElementById('posts-container');
  const empty     = document.getElementById('posts-empty');
  const loading   = document.getElementById('posts-loading');

  loading.style.display = 'none';

  const filtered = currentFilter === 'all'
    ? allPosts
    : allPosts.filter(p => p.category === currentFilter);

  container.innerHTML = '';

  if (filtered.length === 0) {
    empty.style.display     = 'block';
    container.style.display = 'none';
    return;
  }

  empty.style.display     = 'none';
  container.style.display = 'block';

  filtered.forEach(post => {
    const card = document.createElement('div');
    card.className = 'comm-post-card';

    const isOwn = currentUser && currentUser.id === post.user_id;
    const catLabel = CATEGORY_LABELS[post.category] || post.category;

    card.innerHTML = `
      <div class="comm-post-meta">
        <span class="comm-post-badge">${catLabel}</span>
        <span class="comm-post-author">${post.author_name} · ${relativeTime(post.created_at)}</span>
      </div>
      <h3 class="comm-post-title">${post.title}</h3>
      <p class="comm-post-content">${post.content}</p>
      ${isOwn ? `
        <div class="comm-post-actions">
          <button class="comm-delete-btn" data-id="${post.id}">삭제</button>
        </div>` : ''}
    `;

    /* 삭제 버튼 이벤트 */
    if (isOwn) {
      card.querySelector('.comm-delete-btn').addEventListener('click', () => deletePost(post.id));
    }

    container.appendChild(card);
  });
}

/* ── 글 목록 불러오기 ── */
async function loadPosts() {
  const loading = document.getElementById('posts-loading');
  const empty   = document.getElementById('posts-empty');

  loading.style.display   = 'block';
  empty.style.display     = 'none';
  document.getElementById('posts-container').innerHTML = '';

  const { data, error } = await supabaseClient
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('글 목록 오류:', error);
    loading.textContent = '글 목록을 불러오지 못했습니다.';
    return;
  }

  allPosts = data || [];
  renderPosts();
}

/* ── 글 삭제 ── */
async function deletePost(postId) {
  if (!confirm('이 글을 삭제할까요?')) return;

  const { error } = await supabaseClient
    .from('posts')
    .delete()
    .eq('id', postId)
    .eq('user_id', currentUser.id);

  if (error) {
    console.error('삭제 오류:', error);
    alert('삭제 중 오류가 발생했습니다.');
    return;
  }

  await loadPosts();
}

/* ── 폼 열기/닫기 ── */
function openWriteForm() {
  document.getElementById('write-collapsed').style.display = 'none';
  document.getElementById('write-form').style.display      = 'block';
}

function closeWriteForm() {
  document.getElementById('write-form').style.display      = 'none';
  document.getElementById('write-collapsed').style.display = 'block';
  document.getElementById('post-title').value   = '';
  document.getElementById('post-content').value = '';
  /* 카테고리 초기화 */
  const first = document.querySelector('input[name="category"]');
  if (first) { first.checked = true; syncCategoryPills(); }
}

/* ── 메인 ── */
document.addEventListener('DOMContentLoaded', () => {

  /* 세션 확인 */
  supabaseClient.auth.getSession()
    .then(({ data: { session }, error }) => {
      if (error) console.error('세션 확인 오류:', error);
      updateAuthUI(session?.user ?? null);
    });

  /* OAuth 리다이렉트 후 자동 갱신 */
  supabaseClient.auth.onAuthStateChange((event, session) => {
    updateAuthUI(session?.user ?? null);
  });

  /* Google 로그인 */
  document.getElementById('google-login-btn').addEventListener('click', async () => {
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) {
      console.error('로그인 오류:', error);
      alert('로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    }
  });

  /* 로그아웃 */
  document.getElementById('logout-btn').addEventListener('click', async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) console.error('로그아웃 오류:', error);
    else updateAuthUI(null);
  });

  /* 글쓰기 폼 열기/닫기 */
  document.getElementById('open-write-form-btn').addEventListener('click', openWriteForm);
  document.getElementById('close-write-form-btn').addEventListener('click', closeWriteForm);
  document.getElementById('cancel-write-btn').addEventListener('click', closeWriteForm);

  /* 카테고리 라디오 변경 */
  document.querySelectorAll('input[name="category"]').forEach(radio => {
    radio.addEventListener('change', syncCategoryPills);
  });
  syncCategoryPills();

  /* 글 올리기 */
  document.getElementById('submit-post-btn').addEventListener('click', async () => {
    const title   = document.getElementById('post-title').value.trim();
    const content = document.getElementById('post-content').value.trim();
    const category = document.querySelector('input[name="category"]:checked')?.value || 'intro';

    if (!title)   { alert('제목을 입력해 주세요.');  return; }
    if (!content) { alert('내용을 입력해 주세요.'); return; }

    const btn = document.getElementById('submit-post-btn');
    btn.textContent = '올리는 중...';
    btn.disabled = true;

    const { error } = await supabaseClient.from('posts').insert({
      user_id:       currentUser.id,
      author_name:   currentUser.user_metadata?.full_name || currentUser.email,
      author_avatar: currentUser.user_metadata?.avatar_url || null,
      category,
      title,
      content,
    }).select();

    btn.textContent = '올리기';
    btn.disabled = false;

    if (error) {
      console.error('글 작성 오류:', error);
      alert('글을 올리는 중 오류가 발생했습니다.');
      return;
    }

    closeWriteForm();
    await loadPosts();
  });

  /* 필터 버튼 */
  document.querySelectorAll('.comm-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter;
      document.querySelectorAll('.comm-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderPosts();
    });
  });

  /* 초기 글 목록 로드 */
  loadPosts();
});
