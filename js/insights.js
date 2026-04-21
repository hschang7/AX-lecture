/* insights.js — 인사이트 페이지 렌더링 (인사이트 / 추천 도서와 자료 / 인터뷰) */

/* ── 인사이트(본인 글) 렌더링 ── */
function renderInsights(articles) {
  const container = document.getElementById('insights');

  if (!articles || articles.length === 0) {
    container.innerHTML = `
      <div class="res-insights-empty">
        앞으로 이 공간에 짧은 글들을 차곡차곡 기록해 갈 예정입니다.
      </div>`;
    return;
  }

  articles.sort((a, b) => b.date.localeCompare(a.date));

  articles.forEach(article => {
    const card = document.createElement('article');
    card.className = 'ins-article-card';

    /* 헤더 행: 클릭 영역 (메타 + 제목 + 토글 버튼) */
    const header = document.createElement('div');
    header.className = 'ins-article-header';

    const headerLeft = document.createElement('div');
    headerLeft.className = 'ins-article-header-left';

    /* 메타 행: 날짜 + 카테고리 */
    const meta = document.createElement('div');
    meta.className = 'ins-article-meta';

    if (article.date) {
      const dateEl = document.createElement('span');
      dateEl.className = 'ins-article-date';
      dateEl.textContent = article.date;
      meta.appendChild(dateEl);
    }
    if (article.category) {
      const catEl = document.createElement('span');
      catEl.className = 'ins-article-category';
      catEl.textContent = article.category;
      meta.appendChild(catEl);
    }
    headerLeft.appendChild(meta);

    /* 제목 */
    const title = document.createElement('h3');
    title.className = 'ins-article-title';
    title.textContent = article.title;
    headerLeft.appendChild(title);

    header.appendChild(headerLeft);

    /* 토글 버튼 */
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'ins-article-toggle';
    toggleBtn.textContent = '본문 보기';
    toggleBtn.setAttribute('aria-expanded', 'false');
    header.appendChild(toggleBtn);

    card.appendChild(header);

    /* 본문 + 태그 (기본 숨김) */
    const body = document.createElement('div');
    body.className = 'ins-article-body';
    body.hidden = true;

    if (Array.isArray(article.paragraphs)) {
      const paras = document.createElement('div');
      paras.className = 'ins-article-paragraphs';
      article.paragraphs.forEach(text => {
        const p = document.createElement('p');
        p.textContent = text;
        paras.appendChild(p);
      });
      body.appendChild(paras);
    }

    if (Array.isArray(article.tags) && article.tags.length > 0) {
      const tagsWrap = document.createElement('div');
      tagsWrap.className = 'ins-article-tags';
      article.tags.forEach(tag => {
        const span = document.createElement('span');
        span.className = 'ins-article-tag';
        span.textContent = tag;
        tagsWrap.appendChild(span);
      });
      body.appendChild(tagsWrap);
    }

    card.appendChild(body);

    /* 토글 동작 */
    function toggle() {
      const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
      body.hidden = expanded;
      toggleBtn.setAttribute('aria-expanded', String(!expanded));
      toggleBtn.textContent = expanded ? '본문 보기' : '접기';
      card.classList.toggle('ins-article-card--open', !expanded);
    }

    header.addEventListener('click', toggle);

    container.appendChild(card);
  });
}

/* ── 추천 도서와 자료 렌더링 ── */
function renderRecommendations(books) {
  const container = document.getElementById('recommendations');

  if (!books || books.length === 0) {
    container.innerHTML = '<p class="res-empty">등록된 자료가 없습니다.</p>';
    return;
  }

  books.forEach(book => {
    const item = document.createElement('div');
    item.className = 'res-book-item';

    const header = document.createElement('div');
    header.className = 'res-book-header';

    const titleEl = document.createElement('span');
    titleEl.className = 'res-book-title';
    titleEl.textContent = book.title;

    const sep = document.createElement('span');
    sep.className = 'res-book-sep';
    sep.textContent = '·';

    const authorEl = document.createElement('span');
    authorEl.className = 'res-book-author';
    authorEl.textContent = book.author;

    header.appendChild(titleEl);
    header.appendChild(sep);
    header.appendChild(authorEl);
    item.appendChild(header);

    if (book.note) {
      const note = document.createElement('p');
      note.className = 'res-book-note';
      note.textContent = book.note;
      item.appendChild(note);
    }

    container.appendChild(item);
  });
}

/* ── 인터뷰 빈 상태 ── */
function renderInterviewsEmpty() {
  const wrap = document.createElement('div');
  wrap.className = 'ins-interview-empty';

  const main = document.createElement('p');
  main.className = 'ins-interview-empty-main';
  main.textContent = '준비 중입니다.';

  wrap.appendChild(main);
  return wrap;
}

/* ── 인터뷰 카드 (데이터 추가 시 활성화) ── */
function renderInterviewCard(interview) {
  const card = document.createElement('div');
  card.className = 'ins-interview-card';

  /* 인터뷰이 행 */
  const personRow = document.createElement('div');
  personRow.className = 'ins-interviewee-row';

  if (interview.interviewee_photo) {
    const img = document.createElement('img');
    img.className = 'ins-interviewee-photo';
    img.src = interview.interviewee_photo;
    img.alt = interview.interviewee_name || '';
    personRow.appendChild(img);
  } else {
    const initial = document.createElement('div');
    initial.className = 'ins-interviewee-initial';
    initial.textContent = (interview.interviewee_name || '?').charAt(0);
    personRow.appendChild(initial);
  }

  const info = document.createElement('div');
  const nameEl = document.createElement('p');
  nameEl.className = 'ins-interviewee-name';
  nameEl.textContent = interview.interviewee_name || '';

  const titleEl = document.createElement('p');
  titleEl.className = 'ins-interviewee-title';
  titleEl.textContent = interview.interviewee_title || '';

  info.appendChild(nameEl);
  info.appendChild(titleEl);
  personRow.appendChild(info);
  card.appendChild(personRow);

  /* 헤드라인 */
  if (interview.headline) {
    const hl = document.createElement('h3');
    hl.className = 'ins-interview-headline';
    hl.textContent = interview.headline;
    card.appendChild(hl);
  }

  /* 핵심 인용구 */
  if (interview.key_quote) {
    const quote = document.createElement('p');
    quote.className = 'ins-interview-quote';
    quote.textContent = `"${interview.key_quote}"`;
    card.appendChild(quote);
  }

  /* 요약 */
  if (interview.summary) {
    const summary = document.createElement('p');
    summary.className = 'ins-interview-summary';
    summary.textContent = interview.summary;
    card.appendChild(summary);
  }

  /* 태그 */
  if (Array.isArray(interview.tags) && interview.tags.length > 0) {
    const tagsWrap = document.createElement('div');
    tagsWrap.className = 'ins-interview-tags';
    interview.tags.forEach(tag => {
      const span = document.createElement('span');
      span.className = 'ins-interview-tag';
      span.textContent = tag;
      tagsWrap.appendChild(span);
    });
    card.appendChild(tagsWrap);
  }

  /* 하단 메타 */
  const footer = document.createElement('div');
  footer.className = 'ins-interview-footer';

  const dateEl = document.createElement('span');
  dateEl.className = 'ins-interview-date';
  dateEl.textContent = interview.date || '';
  footer.appendChild(dateEl);

  if (interview.url) {
    const readMore = document.createElement('a');
    readMore.className = 'ins-interview-read-more';
    readMore.href = interview.url;
    readMore.textContent = '전문 읽기 →';
    readMore.target = '_blank';
    readMore.rel = 'noopener noreferrer';
    footer.appendChild(readMore);
  }

  card.appendChild(footer);
  return card;
}

/* ── 인터뷰 렌더링 ── */
function renderInterviews(interviews) {
  const container = document.getElementById('interviews');

  if (!interviews || interviews.length === 0) {
    container.appendChild(renderInterviewsEmpty());
    return;
  }

  interviews.forEach(item => container.appendChild(renderInterviewCard(item)));
}

/* ── 에러 메시지 ── */
function showError(id, msg = '정보를 불러오지 못했습니다.') {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<p class="res-empty">${msg}</p>`;
}

/* ── 메인: 세 fetch 병렬 실행 ── */
document.addEventListener('DOMContentLoaded', () => {
  fetch('data/insights.json')
    .then(r => { if (!r.ok) throw new Error(); return r.json(); })
    .then(d => renderInsights(d.articles))
    .catch(() => showError('insights'));

  fetch('data/recommendations.json')
    .then(r => { if (!r.ok) throw new Error(); return r.json(); })
    .then(d => renderRecommendations(d.books))
    .catch(() => showError('recommendations'));

  fetch('data/interviews.json')
    .then(r => { if (!r.ok) throw new Error(); return r.json(); })
    .then(d => renderInterviews(d.interviews))
    .catch(() => showError('interviews'));
});
