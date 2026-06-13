/* insights.js — 인사이트 페이지 렌더링 + 카테고리 필터 */

let allInsightsArticles = [];
let activeInsightsCategory = '전체';

/* ── 인사이트 글 목록 렌더링 ── */
function renderInsights(articles) {
  const container = document.getElementById('insights');
  container.innerHTML = '';

  if (!articles || articles.length === 0) {
    container.innerHTML = `
      <div class="res-insights-empty">
        이 카테고리에는 아직 글이 없습니다.
      </div>`;
    return;
  }

  const sorted = [...articles].sort((a, b) => b.date.localeCompare(a.date));

  sorted.forEach(article => {
    const card = document.createElement('article');
    card.className = 'ins-article-card';

    const header = document.createElement('div');
    header.className = 'ins-article-header';

    const headerLeft = document.createElement('div');
    headerLeft.className = 'ins-article-header-left';

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

    const title = document.createElement('h3');
    title.className = 'ins-article-title';
    title.textContent = article.title;
    headerLeft.appendChild(title);

    header.appendChild(headerLeft);

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'ins-article-toggle';
    toggleBtn.textContent = '본문 보기';
    toggleBtn.setAttribute('aria-expanded', 'false');
    header.appendChild(toggleBtn);

    card.appendChild(header);

    const body = document.createElement('div');
    body.className = 'ins-article-body';
    body.hidden = true;

    if (Array.isArray(article.paragraphs)) {
      const paras = document.createElement('div');
      paras.className = 'ins-article-paragraphs';
      article.paragraphs.forEach(text => {
        if (typeof text === 'string' && text.startsWith('## ')) {
          const h = document.createElement('h4');
          h.className = 'ins-article-subhead';
          h.textContent = text.slice(3).trim();
          paras.appendChild(h);
        } else {
          const p = document.createElement('p');
          p.textContent = text;
          paras.appendChild(p);
        }
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

/* ── 카테고리 필터 바 렌더링 (카테고리는 데이터에서 자동 추출) ── */
function renderInsightsFilter() {
  const bar = document.getElementById('insights-filter');
  if (!bar) return;
  bar.innerHTML = '';

  const cats = ['전체', ...Array.from(new Set(allInsightsArticles.map(a => a.category).filter(Boolean)))];

  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'ins-filter-btn' + (cat === activeInsightsCategory ? ' active' : '');
    btn.textContent = cat;
    btn.setAttribute('aria-pressed', String(cat === activeInsightsCategory));
    btn.addEventListener('click', () => {
      activeInsightsCategory = cat;
      renderInsightsFilter();
      applyInsightsFilter();
    });
    bar.appendChild(btn);
  });
}

/* ── 필터 적용 ── */
function applyInsightsFilter() {
  const list = activeInsightsCategory === '전체'
    ? allInsightsArticles
    : allInsightsArticles.filter(a => a.category === activeInsightsCategory);
  renderInsights(list);
}

/* ── 에러 메시지 ── */
function showInsightsError(msg = '정보를 불러오지 못했습니다.') {
  const el = document.getElementById('insights');
  if (el) el.innerHTML = `<p class="res-empty">${msg}</p>`;
}

/* ── 메인 ── */
document.addEventListener('DOMContentLoaded', () => {
  fetch('data/insights.json')
    .then(r => { if (!r.ok) throw new Error(); return r.json(); })
    .then(d => {
      allInsightsArticles = d.articles || [];
      renderInsightsFilter();
      applyInsightsFilter();
    })
    .catch(() => showInsightsError());
});
