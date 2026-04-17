/* lectures.js — 통합 강연 타임라인 렌더링
 *
 * lectures.json 강연 객체 구조:
 * - id, title, date (필수)
 * - time, location, audience, description (선택)
 * - outline: 강연 목차 배열 (선택)
 * - key_messages: 핵심 메시지 배열 (선택)
 * - news_coverage: 언론 보도 배열 (선택, 각 항목: { outlet, title, url, date })
 */

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

function formatDateLong(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const day = DAYS[new Date(y, m - 1, d).getDay()];
  return `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')} ${day}요일`;
}

function formatDateShort(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`;
}

function formatTime(timeStr) {
  const [h, min] = timeStr.split(':').map(Number);
  const period = h < 12 ? '오전' : '오후';
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${period} ${hour}:${String(min).padStart(2, '0')}`;
}

function todayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/* 언론 보도 항목 빌드 — anchor는 DOM으로 직접 생성 (XSS 방지) */
function buildNewsCoverage(items) {
  const wrap = document.createElement('div');

  const label = document.createElement('p');
  label.className = 'lec-expand-label';
  label.textContent = '언론 보도';
  wrap.appendChild(label);

  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'lec-news-item';

    const meta = document.createElement('p');
    meta.className = 'lec-news-meta';
    meta.textContent = [item.outlet, item.date ? formatDateShort(item.date) : ''].filter(Boolean).join(' · ');
    row.appendChild(meta);

    const a = document.createElement('a');
    a.className = 'lec-news-link';
    a.href = item.url;
    a.textContent = `"${item.title}"`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    row.appendChild(a);

    wrap.appendChild(row);
  });

  return wrap;
}

/* 다가오는 강연 카드 */
function renderUpcomingCard(lecture) {
  const card = document.createElement('div');
  card.className = 'lec-card lec-card--upcoming';

  const metaItems = [];
  if (lecture.time)     metaItems.push(`<div class="lec-meta-item"><span class="lec-meta-label">시간</span><span class="lec-meta-value">${formatTime(lecture.time)}</span></div>`);
  if (lecture.location) metaItems.push(`<div class="lec-meta-item"><span class="lec-meta-label">장소</span><span class="lec-meta-value">${lecture.location}</span></div>`);
  if (lecture.audience) metaItems.push(`<div class="lec-meta-item"><span class="lec-meta-label">대상</span><span class="lec-meta-value">${lecture.audience}</span></div>`);

  card.innerHTML = `
    <span class="lec-card-upcoming-label">upcoming</span>
    <span class="lec-date-badge">${formatDateLong(lecture.date)}</span>
    <h3 class="lec-upcoming-title">${lecture.title}</h3>
    ${lecture.description ? `<p class="lec-upcoming-desc">${lecture.description}</p>` : ''}
    ${metaItems.length ? `<div class="lec-upcoming-meta">${metaItems.join('')}</div>` : ''}
  `;
  return card;
}

/* 펼칠 콘텐츠 존재 여부 판별 */
function hasExpandableContent(lecture) {
  return (
    (Array.isArray(lecture.outline)       && lecture.outline.length > 0)       ||
    (Array.isArray(lecture.key_messages)  && lecture.key_messages.length > 0)  ||
    (Array.isArray(lecture.news_coverage) && lecture.news_coverage.length > 0)
  );
}

/* 지난 강연 카드 */
function renderPastCard(lecture) {
  const hasOutline   = Array.isArray(lecture.outline)        && lecture.outline.length > 0;
  const hasMessages  = Array.isArray(lecture.key_messages)   && lecture.key_messages.length > 0;
  const hasCoverage  = Array.isArray(lecture.news_coverage)  && lecture.news_coverage.length > 0;
  const expandable   = hasExpandableContent(lecture);

  const card = document.createElement('div');
  card.className = 'lec-card lec-card--past' + (expandable ? ' lec-card--expandable' : '');

  /* 카드 헤더 */
  const header = document.createElement('div');
  header.className = 'lec-card-header';

  const main = document.createElement('div');
  main.className = 'lec-card-main';
  main.innerHTML = `
    <p class="lec-card-date">${formatDateShort(lecture.date)}</p>
    <h3 class="lec-card-title">${lecture.title}</h3>
    ${lecture.location ? `<p class="lec-card-location">${lecture.location}</p>` : ''}
  `;
  header.appendChild(main);

  if (expandable) {
    const toggle = document.createElement('span');
    toggle.className = 'lec-card-toggle';
    toggle.textContent = '▾';
    header.appendChild(toggle);
  }

  card.appendChild(header);

  /* 하단 힌트 — expandable일 때만 DOM에 추가 */
  if (expandable) {
    const hint = document.createElement('p');
    hint.className = 'lec-card-hint';
    hint.textContent = '펼쳐서 목차와 핵심 메시지 보기 ▾';
    card.appendChild(hint);
  }

  /* 펼침 영역 */
  if (expandable) {
    const expand = document.createElement('div');
    expand.className = 'lec-expand';

    if (hasOutline) {
      const label = document.createElement('p');
      label.className = 'lec-expand-label';
      label.textContent = '목차';
      expand.appendChild(label);

      const ol = document.createElement('ol');
      ol.className = 'res-outline-list';
      lecture.outline.forEach((item, i) => {
        const li = document.createElement('li');
        li.className = 'res-outline-item';
        li.innerHTML = `<span class="res-outline-num">${i + 1}</span>`;
        const text = document.createTextNode(item);
        li.appendChild(text);
        ol.appendChild(li);
      });
      expand.appendChild(ol);
    }

    if (hasMessages) {
      const label = document.createElement('p');
      label.className = 'lec-expand-label';
      label.textContent = '핵심 메시지';
      expand.appendChild(label);

      const msgWrap = document.createElement('div');
      msgWrap.className = 'res-keymsg-list';
      lecture.key_messages.forEach(msg => {
        const p = document.createElement('p');
        p.className = 'res-keymsg-item';
        p.textContent = msg;
        msgWrap.appendChild(p);
      });
      expand.appendChild(msgWrap);
    }

    if (hasCoverage) {
      expand.appendChild(buildNewsCoverage(lecture.news_coverage));
    }

    card.appendChild(expand);
  }

  return card;
}

/* 메인 */
document.addEventListener('DOMContentLoaded', () => {
  const today    = todayStr();
  const timeline = document.getElementById('lecture-timeline');

  fetch('data/lectures.json')
    .then(res => { if (!res.ok) throw new Error(); return res.json(); })
    .then(data => {
      const upcoming = data.lectures
        .filter(l => l.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date));

      const past = data.lectures
        .filter(l => l.date < today)
        .sort((a, b) => b.date.localeCompare(a.date));

      if (upcoming.length === 0 && past.length === 0) {
        timeline.innerHTML = '<p class="lec-empty">등록된 강연이 없습니다.</p>';
        return;
      }

      upcoming.forEach(l => timeline.appendChild(renderUpcomingCard(l)));
      past.forEach(l => timeline.appendChild(renderPastCard(l)));
    })
    .catch(() => {
      timeline.innerHTML = '<p class="lec-empty">강연 정보를 불러오지 못했습니다.</p>';
    });

  /* 이벤트 위임 — 지난 강연 카드 접기/펼치기 */
  document.getElementById('lecture-timeline').addEventListener('click', e => {
    const card = e.target.closest('.lec-card--expandable');
    if (!card) return;
    const expand = card.querySelector('.lec-expand');
    const toggle = card.querySelector('.lec-card-toggle');
    const hint   = card.querySelector('.lec-card-hint');
    const isOpen = expand.classList.contains('open');
    expand.classList.toggle('open', !isOpen);
    if (toggle) toggle.textContent = isOpen ? '▾' : '▴';
    if (hint)   hint.style.display = isOpen ? '' : 'none';
  });
});
