/* resources.js — 자료실 페이지 렌더링 */

/* YYYY-MM-DD → "YYYY.MM.DD" */
function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`;
}

/* 장소 이름을 짧게 자름 (첫 번째 기관명만) */
function shortLocation(loc) {
  if (!loc) return '';
  return loc.split(' ')[0];
}

/* ── 강연 아카이브 렌더링 ── */
function renderArchive(lectures) {
  const container = document.getElementById('lecture-archive');

  const filtered = lectures
    .filter(l => Array.isArray(l.outline) && l.outline.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (filtered.length === 0) {
    container.innerHTML = '<p class="res-empty">아직 등록된 강연 자료가 없습니다.</p>';
    return;
  }

  filtered.forEach(lecture => {
    const card = document.createElement('div');
    card.className = 'res-archive-card';

    const outlineItems = lecture.outline
      .map((item, i) => `<li class="res-outline-item"><span class="res-outline-num">${i + 1}</span>${item}</li>`)
      .join('');

    const keyMsgItems = (lecture.key_messages || [])
      .map(msg => `<p class="res-keymsg-item">${msg}</p>`)
      .join('');

    const meta = [
      fmtDate(lecture.date),
      shortLocation(lecture.location),
    ].filter(Boolean).join(' · ');

    card.innerHTML = `
      <p class="res-archive-meta">${meta}</p>
      <h3 class="res-archive-title">${lecture.title}</h3>
      ${outlineItems ? `
        <p class="res-sub-label">목차</p>
        <ol class="res-outline-list">${outlineItems}</ol>
      ` : ''}
      ${keyMsgItems ? `
        <p class="res-sub-label">핵심 메시지</p>
        <div class="res-keymsg-list">${keyMsgItems}</div>
      ` : ''}
    `;
    container.appendChild(card);
  });
}

/* ── 인사이트 렌더링 ── */
function renderInsights(articles) {
  const container = document.getElementById('insights');

  if (!articles || articles.length === 0) {
    container.innerHTML = `
      <div class="res-insights-empty">
        앞으로 이 공간에 짧은 글들을 차곡차곡 기록해 갈 예정입니다.
      </div>`;
    return;
  }

  /* 글이 생기면 여기에 렌더링 로직 추가 */
  articles.forEach(article => {
    const el = document.createElement('div');
    el.className = 'res-article-card';
    el.innerHTML = `<h3>${article.title}</h3>`;
    container.appendChild(el);
  });
}

/* ── 추천 자료 렌더링 ── */
function renderRecommendations(books) {
  const container = document.getElementById('recommendations');

  if (!books || books.length === 0) {
    container.innerHTML = '<p class="res-empty">등록된 자료가 없습니다.</p>';
    return;
  }

  books.forEach(book => {
    const item = document.createElement('div');
    item.className = 'res-book-item';
    item.innerHTML = `
      <div class="res-book-header">
        <span class="res-book-title">${book.title}</span>
        <span class="res-book-sep">·</span>
        <span class="res-book-author">${book.author}</span>
      </div>
      ${book.note ? `<p class="res-book-note">${book.note}</p>` : ''}
    `;
    container.appendChild(item);
  });
}

/* ── 에러 메시지 표시 ── */
function showError(id, msg = '정보를 불러오지 못했습니다.') {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<p class="res-empty">${msg}</p>`;
}

/* ── 메인: 세 fetch 병렬 실행 ── */
document.addEventListener('DOMContentLoaded', () => {
  /* 강연 아카이브 */
  fetch('data/lectures.json')
    .then(r => { if (!r.ok) throw new Error(); return r.json(); })
    .then(d => renderArchive(d.lectures))
    .catch(() => showError('lecture-archive'));

  /* 인사이트 */
  fetch('data/insights.json')
    .then(r => { if (!r.ok) throw new Error(); return r.json(); })
    .then(d => renderInsights(d.articles))
    .catch(() => showError('insights'));

  /* 추천 자료 */
  fetch('data/recommendations.json')
    .then(r => { if (!r.ok) throw new Error(); return r.json(); })
    .then(d => renderRecommendations(d.books))
    .catch(() => showError('recommendations'));
});
