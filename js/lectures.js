/* lectures.js — 강연 데이터를 읽어 화면에 렌더링 */

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

/* YYYY-MM-DD → "YYYY.MM.DD 요일" */
function formatDateLong(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const day = DAYS[new Date(y, m - 1, d).getDay()];
  return `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')} ${day}요일`;
}

/* YYYY-MM-DD → "YYYY.MM.DD" */
function formatDateShort(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`;
}

/* "HH:MM" → "오전/오후 H:MM" */
function formatTime(timeStr) {
  const [h, min] = timeStr.split(':').map(Number);
  const period = h < 12 ? '오전' : '오후';
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${period} ${hour}:${String(min).padStart(2, '0')}`;
}

/* 오늘 날짜를 "YYYY-MM-DD" 문자열로 반환 */
function todayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/* 다가오는 강연 카드 */
function renderUpcoming(lecture) {
  const card = document.createElement('div');
  card.className = 'lec-upcoming-card';

  /* 메타 항목 조립 */
  const metaItems = [];
  if (lecture.time) {
    metaItems.push(`
      <div class="lec-meta-item">
        <span class="lec-meta-label">시간</span>
        <span class="lec-meta-value">${formatTime(lecture.time)}</span>
      </div>`);
  }
  if (lecture.location) {
    metaItems.push(`
      <div class="lec-meta-item">
        <span class="lec-meta-label">장소</span>
        <span class="lec-meta-value">${lecture.location}</span>
      </div>`);
  }
  if (lecture.audience) {
    metaItems.push(`
      <div class="lec-meta-item">
        <span class="lec-meta-label">대상</span>
        <span class="lec-meta-value">${lecture.audience}</span>
      </div>`);
  }

  card.innerHTML = `
    <span class="lec-date-badge">${formatDateLong(lecture.date)}</span>
    <h3 class="lec-upcoming-title">${lecture.title}</h3>
    ${lecture.description ? `<p class="lec-upcoming-desc">${lecture.description}</p>` : ''}
    ${metaItems.length ? `<div class="lec-upcoming-meta">${metaItems.join('')}</div>` : ''}
  `;
  return card;
}

/* 지난 강연 행 */
function renderPast(lecture) {
  const row = document.createElement('div');
  row.className = 'lec-past-row';
  row.innerHTML = `
    <span class="lec-past-date">${formatDateShort(lecture.date)}</span>
    <div class="lec-past-content">
      <p class="lec-past-title">${lecture.title}</p>
      ${lecture.location ? `<p class="lec-past-location">${lecture.location}</p>` : ''}
    </div>
  `;
  return row;
}

/* 메시지 표시 */
function showMessage(containerId, text) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `<p class="lec-empty">${text}</p>`;
}

/* 메인 */
document.addEventListener('DOMContentLoaded', () => {
  const today = todayStr();

  fetch('data/lectures.json')
    .then(res => {
      if (!res.ok) throw new Error('fetch failed');
      return res.json();
    })
    .then(data => {
      const upcoming = data.lectures
        .filter(l => l.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date));

      const past = data.lectures
        .filter(l => l.date < today)
        .sort((a, b) => b.date.localeCompare(a.date));

      const upcomingEl = document.getElementById('upcoming-lectures');
      if (upcoming.length === 0) {
        upcomingEl.innerHTML = '<p class="lec-empty">현재 예정된 강연이 없습니다.</p>';
      } else {
        upcoming.forEach(l => upcomingEl.appendChild(renderUpcoming(l)));
      }

      const pastEl = document.getElementById('past-lectures');
      if (past.length === 0) {
        pastEl.innerHTML = '<p class="lec-empty">지난 강연이 없습니다.</p>';
      } else {
        past.forEach(l => pastEl.appendChild(renderPast(l)));
      }
    })
    .catch(() => {
      showMessage('upcoming-lectures', '강연 정보를 불러오지 못했습니다.');
      showMessage('past-lectures', '강연 정보를 불러오지 못했습니다.');
    });
});
