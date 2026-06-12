/* life.js — 삶 이야기 페이지 렌더링 (인생 소회·지혜 글 목록) */

/* ── 삶 이야기 글 렌더링 ── */
function renderLifeArticles(articles) {
  const container = document.getElementById('life-articles');

  if (!articles || articles.length === 0) {
    container.innerHTML = `
      <div class="res-insights-empty">
        살아가며 떠오르는 생각들을 이 자리에 하나씩 적어 두려 합니다.
      </div>`;
    return;
  }

  articles.sort((a, b) => b.date.localeCompare(a.date));

  articles.forEach(article => {
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

/* ── 에러 메시지 ── */
function showLifeError(msg = '정보를 불러오지 못했습니다.') {
  const el = document.getElementById('life-articles');
  if (el) el.innerHTML = `<p class="res-empty">${msg}</p>`;
}

/* ── 메인: 삶 이야기 글 불러오기 ── */
document.addEventListener('DOMContentLoaded', () => {
  fetch('data/life.json')
    .then(r => { if (!r.ok) throw new Error(); return r.json(); })
    .then(d => renderLifeArticles(d.articles))
    .catch(() => showLifeError());
});
