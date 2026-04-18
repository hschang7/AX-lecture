/* community.js — 1~4단계: 로그인 + 글쓰기/삭제 + 댓글 + 글 수정 */

/* ── 본문 안전 렌더링: [텍스트](url) → <a> 변환, 나머지는 textContent ── */
function renderContentWithLinks(rawText, container) {
  const pattern = /\[([^\]]{1,100})\]\(([^)]{1,300})\)/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(rawText)) !== null) {
    if (match.index > lastIndex) {
      container.appendChild(document.createTextNode(rawText.slice(lastIndex, match.index)));
    }

    const linkText = match[1];
    const url      = match[2];
    const safe     = /^(https?:\/\/|[a-zA-Z0-9_-]+\.html)([\w\-./=?&#%]*)$/.test(url)
                     && !/javascript:/i.test(url);

    if (safe) {
      const a = document.createElement('a');
      a.textContent = linkText;
      a.href        = url;
      a.className   = 'comm-inline-link';
      if (url.startsWith('http')) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      container.appendChild(a);
    } else {
      container.appendChild(document.createTextNode(match[0]));
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < rawText.length) {
    container.appendChild(document.createTextNode(rawText.slice(lastIndex)));
  }
}

/* ── 전역 상태 ── */
let currentUser   = null;
let currentFilter = 'all';
let allPosts      = [];

const CATEGORY_LABELS = {
  intro:  '자기소개',
  prompt: '프롬프트',
  tip:    'AI 활용팁',
  info:   '알게 된 정보',
};

/* 상대 시간 포맷 */
function relativeTime(isoStr) {
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60)         return '방금 전';
  if (diff < 3600)       return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400)      return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 86400 * 2)  return '어제';
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}일 전`;
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
    avatar.src           = meta.avatar_url || '';
    avatar.style.display = meta.avatar_url ? 'block' : 'none';
    userName.textContent = meta.full_name || user.email;
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
    const isOwn    = currentUser && currentUser.id === post.user_id;
    const catLabel = CATEGORY_LABELS[post.category] || post.category;
    const pid      = post.id;

    /* 수정됨 배지 계산 */
    let editedBadge = '';
    if (post.updated_at) {
      const diff = Math.abs(new Date(post.updated_at) - new Date(post.created_at)) / 1000;
      if (diff >= 60) editedBadge = ' · 수정됨';
    }

    const card = document.createElement('div');
    card.className      = 'comm-post-card';
    card.dataset.postId = pid;

    /* 카드 뼈대 — 구조만, 사용자 텍스트 없음 */
    card.innerHTML = `
      <div class="comm-post-meta">
        <span class="comm-post-badge"></span>
        <span class="comm-post-author"></span>
      </div>

      <!-- 읽기 모드 -->
      <h3 class="comm-post-title"></h3>
      <p class="comm-post-content"></p>

      <!-- 수정 모드 (기본 숨김) -->
      <div class="comm-edit-mode" data-edit-mode="${pid}" style="display:none;">
        <input  type="text"
                class="comm-input comm-edit-title"
                data-edit-title="${pid}"
                maxlength="80"
                placeholder="제목">
        <textarea class="comm-textarea comm-edit-content"
                  data-edit-content="${pid}"
                  rows="6"
                  placeholder="내용"></textarea>
        <div class="comm-edit-actions">
          <button class="comm-edit-cancel-btn" data-edit-cancel="${pid}">취소</button>
          <button class="comm-edit-save-btn"   data-edit-save="${pid}">저장</button>
        </div>
      </div>

      ${isOwn ? `
        <div class="comm-post-actions" data-post-actions="${pid}">
          <button class="comm-edit-btn"   data-post-edit="${pid}">수정</button>
          <button class="comm-delete-btn" data-delete-post="${pid}">삭제</button>
        </div>` : ''}

      <!-- 댓글 영역 -->
      <div class="comm-comment-area">
        <div class="comm-comment-list" data-comments-for="${pid}">
          <p class="comm-comment-loading">댓글 불러오는 중...</p>
        </div>
        ${currentUser ? `
          <div class="comm-comment-input-wrap">
            <button class="comm-comment-toggle-btn" data-comment-toggle="${pid}">+ 댓글 달기</button>
            <div class="comm-comment-form" data-comment-form="${pid}" style="display:none;">
              <textarea class="comm-comment-textarea" data-comment-input="${pid}" rows="2"
                placeholder="댓글을 남겨주세요"></textarea>
              <div class="comm-comment-form-actions">
                <button class="comm-comment-cancel-btn" data-comment-cancel="${pid}">취소</button>
                <button class="comm-comment-submit-btn" data-comment-submit="${pid}">올리기</button>
              </div>
            </div>
          </div>` : ''}
      </div>
    `;

    /* 사용자 생성 텍스트 — textContent 로 안전하게 삽입 (XSS 방지) */
    card.querySelector('.comm-post-badge').textContent  = catLabel;
    card.querySelector('.comm-post-author').textContent =
      `${post.author_name} · ${relativeTime(post.created_at)}${editedBadge}`;
    card.querySelector('.comm-post-title').textContent  = post.title;
    renderContentWithLinks(post.content, card.querySelector('.comm-post-content'));

    container.appendChild(card);
  });

  /* 각 글의 댓글 병렬 로드 */
  filtered.forEach(post => loadCommentsForPost(post.id));
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
    .from('posts').delete()
    .eq('id', postId)
    .eq('user_id', currentUser.id);

  if (error) {
    console.error('글 삭제 오류:', error);
    alert('삭제 중 오류가 발생했습니다.');
    return;
  }
  await loadPosts();
}

/* ── 글쓰기 폼 열기/닫기 ── */
function openWriteForm() {
  document.getElementById('write-collapsed').style.display = 'none';
  document.getElementById('write-form').style.display      = 'block';
}

function closeWriteForm() {
  document.getElementById('write-form').style.display      = 'none';
  document.getElementById('write-collapsed').style.display = 'block';
  document.getElementById('post-title').value   = '';
  document.getElementById('post-content').value = '';
  const first = document.querySelector('input[name="category"]');
  if (first) { first.checked = true; syncCategoryPills(); }
}

/* ── 수정 모드 진입 ── */
function enterEditMode(card, post) {
  const pid = post.id;
  card.querySelector('.comm-post-title').style.display   = 'none';
  card.querySelector('.comm-post-content').style.display = 'none';
  const actions = card.querySelector(`[data-post-actions="${pid}"]`);
  if (actions) actions.style.display = 'none';

  const editMode = card.querySelector(`[data-edit-mode="${pid}"]`);
  editMode.querySelector(`[data-edit-title="${pid}"]`).value   = post.title;   /* .value — input이므로 OK */
  editMode.querySelector(`[data-edit-content="${pid}"]`).value = post.content;
  editMode.style.display = 'block';
  editMode.querySelector(`[data-edit-title="${pid}"]`).focus();
}

/* ── 수정 모드 종료 (취소) ── */
function exitEditMode(card, pid) {
  card.querySelector(`[data-edit-mode="${pid}"]`).style.display  = 'none';
  card.querySelector('.comm-post-title').style.display           = '';
  card.querySelector('.comm-post-content').style.display         = '';
  const actions = card.querySelector(`[data-post-actions="${pid}"]`);
  if (actions) actions.style.display = 'flex';
}

/* ── 댓글 불러오기 ── */
async function loadCommentsForPost(postId) {
  const listEl = document.querySelector(`[data-comments-for="${postId}"]`);
  if (!listEl) return;

  const { data, error } = await supabaseClient
    .from('comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  listEl.innerHTML = '';

  if (error) {
    console.error('댓글 오류:', error);
    const el = document.createElement('p');
    el.className = 'comm-comment-loading';
    el.textContent = '댓글을 불러오지 못했습니다.';
    listEl.appendChild(el);
    return;
  }

  if (!data || data.length === 0) {
    const el = document.createElement('p');
    el.className   = 'comm-comment-empty';
    el.textContent = '아직 댓글이 없어요.';
    listEl.appendChild(el);
    return;
  }

  data.forEach(comment => {
    const item   = document.createElement('div');
    item.className = 'comm-comment-item';

    const header = document.createElement('div');
    header.className = 'comm-comment-header';

    const authorEl = document.createElement('span');
    authorEl.className   = 'comm-comment-author';
    authorEl.textContent = comment.author_name;     /* textContent — XSS 방지 */

    const timeEl = document.createElement('span');
    timeEl.className   = 'comm-comment-time';
    timeEl.textContent = relativeTime(comment.created_at);

    header.appendChild(authorEl);
    header.appendChild(timeEl);

    if (currentUser && currentUser.id === comment.user_id) {
      const delBtn = document.createElement('button');
      delBtn.className         = 'comm-comment-delete-btn';
      delBtn.textContent       = '삭제';
      delBtn.dataset.commentId = comment.id;
      delBtn.dataset.postId    = postId;
      header.appendChild(delBtn);
    }

    const contentEl = document.createElement('p');
    contentEl.className   = 'comm-comment-content';
    contentEl.textContent = comment.content;        /* textContent — XSS 방지 */

    item.appendChild(header);
    item.appendChild(contentEl);
    listEl.appendChild(item);
  });
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
      options: { redirectTo: window.location.origin + '/' },
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

  /* 글쓰기 폼 */
  document.getElementById('open-write-form-btn').addEventListener('click', openWriteForm);
  document.getElementById('close-write-form-btn').addEventListener('click', closeWriteForm);
  document.getElementById('cancel-write-btn').addEventListener('click', closeWriteForm);

  /* 카테고리 라디오 */
  document.querySelectorAll('input[name="category"]').forEach(radio => {
    radio.addEventListener('change', syncCategoryPills);
  });
  syncCategoryPills();

  /* 글 올리기 */
  document.getElementById('submit-post-btn').addEventListener('click', async () => {
    const title    = document.getElementById('post-title').value.trim();
    const content  = document.getElementById('post-content').value.trim();
    const category = document.querySelector('input[name="category"]:checked')?.value || 'intro';

    if (!title)   { alert('제목을 입력해 주세요.');  return; }
    if (!content) { alert('내용을 입력해 주세요.'); return; }

    const btn = document.getElementById('submit-post-btn');
    btn.textContent = '올리는 중...';
    btn.disabled    = true;

    const { error } = await supabaseClient.from('posts').insert({
      user_id:       currentUser.id,
      author_name:   currentUser.user_metadata?.full_name || currentUser.email,
      author_avatar: currentUser.user_metadata?.avatar_url || null,
      category,
      title,
      content,
    }).select();

    btn.textContent = '올리기';
    btn.disabled    = false;

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

  /* ── posts-container 이벤트 위임 (댓글 + 글 수정) ── */
  document.getElementById('posts-container').addEventListener('click', async (e) => {
    const t    = e.target;
    const card = t.closest('.comm-post-card');

    /* ── 글 삭제 ── */
    if (t.dataset.deletePost) {
      await deletePost(t.dataset.deletePost);
      return;
    }

    /* ── 수정 모드 진입 ── */
    if (t.dataset.postEdit) {
      const post = allPosts.find(p => String(p.id) === String(t.dataset.postEdit));
      if (post && card) enterEditMode(card, post);
      return;
    }

    /* ── 수정 취소 ── */
    if (t.dataset.editCancel) {
      if (card) exitEditMode(card, t.dataset.editCancel);
      return;
    }

    /* ── 수정 저장 ── */
    if (t.dataset.editSave) {
      const pid      = t.dataset.editSave;
      const post     = allPosts.find(p => String(p.id) === String(pid));
      const editMode = card?.querySelector(`[data-edit-mode="${pid}"]`);
      if (!post || !editMode) return;

      const newTitle   = editMode.querySelector(`[data-edit-title="${pid}"]`).value.trim();
      const newContent = editMode.querySelector(`[data-edit-content="${pid}"]`).value.trim();

      if (!newTitle || !newContent) {
        alert('제목과 내용을 입력해주세요.');
        return;
      }

      /* 변경 없으면 그냥 닫기 */
      if (newTitle === post.title && newContent === post.content) {
        exitEditMode(card, pid);
        return;
      }

      t.textContent = '저장 중...';
      t.disabled    = true;

      const { error } = await supabaseClient
        .from('posts')
        .update({ title: newTitle, content: newContent, updated_at: new Date().toISOString() })
        .eq('id', pid);

      t.textContent = '저장';
      t.disabled    = false;

      if (error) {
        console.error('수정 오류:', error);
        alert('수정 중 오류가 발생했습니다.');
        return;
      }

      await loadPosts();
      return;
    }

    /* ── 댓글 달기 버튼 → 폼 열기 ── */
    if (t.dataset.commentToggle) {
      const postId = t.dataset.commentToggle;
      t.style.display = 'none';
      const form = document.querySelector(`[data-comment-form="${postId}"]`);
      form.style.display = 'block';
      form.querySelector(`[data-comment-input="${postId}"]`).focus();
      return;
    }

    /* ── 댓글 취소 ── */
    if (t.dataset.commentCancel) {
      const postId = t.dataset.commentCancel;
      const form   = document.querySelector(`[data-comment-form="${postId}"]`);
      form.style.display = 'none';
      form.querySelector(`[data-comment-input="${postId}"]`).value = '';
      document.querySelector(`[data-comment-toggle="${postId}"]`).style.display = 'inline-block';
      return;
    }

    /* ── 댓글 올리기 ── */
    if (t.dataset.commentSubmit) {
      const postId   = t.dataset.commentSubmit;
      const textarea = document.querySelector(`[data-comment-input="${postId}"]`);
      const content  = textarea.value.trim();

      if (!content) { alert('댓글 내용을 입력해주세요.'); return; }

      t.textContent = '올리는 중...';
      t.disabled    = true;

      const { error } = await supabaseClient.from('comments').insert({
        post_id:     postId,
        user_id:     currentUser.id,
        author_name: currentUser.user_metadata?.full_name || currentUser.email,
        content,
      });

      t.textContent = '올리기';
      t.disabled    = false;

      if (error) {
        console.error('댓글 작성 오류:', error);
        alert('댓글을 올리는 중 오류가 발생했습니다.');
        return;
      }

      const form = document.querySelector(`[data-comment-form="${postId}"]`);
      form.style.display = 'none';
      textarea.value     = '';
      document.querySelector(`[data-comment-toggle="${postId}"]`).style.display = 'inline-block';

      await loadCommentsForPost(postId);
      return;
    }

    /* ── 댓글 삭제 ── */
    if (t.dataset.commentId) {
      const commentId = t.dataset.commentId;
      const postId    = t.dataset.postId;

      if (!confirm('이 댓글을 삭제할까요?')) return;

      const { error } = await supabaseClient
        .from('comments').delete()
        .eq('id', commentId);

      if (error) {
        console.error('댓글 삭제 오류:', error);
        alert('댓글 삭제 중 오류가 발생했습니다.');
        return;
      }

      await loadCommentsForPost(postId);
      return;
    }
  });

  /* 초기 글 목록 로드 */
  loadPosts();
});
