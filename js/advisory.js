/* advisory.js — 경영자문 내역 렌더링
 *
 * advisory.json 항목 구조:
 * - id, company, year, type (필수)
 * - field, role (선택)
 *
 * 정렬: 연도 내림차순 그룹핑, 같은 연도 안에서는 장기자문 → 단기자문 순.
 * 카드는 강연의 .lec-card 스타일을 재사용하되 펼침 기능은 없다.
 * 텍스트는 모두 textContent로 출력(XSS 방지) — lectures.js의 안전 렌더 패턴 준수.
 */

const ADV_TYPE_ORDER = { '장기자문': 0, '단기자문': 1 };

/* 경영자문 카드 (정적, 펼침 없음) */
function renderAdvisoryCard(item) {
  const card = document.createElement('div');
  card.className = 'lec-card lec-card--advisory';

  if (item.type) {
    const badge = document.createElement('span');
    badge.className = 'adv-type-badge';
    badge.textContent = item.type;
    card.appendChild(badge);
  }

  const title = document.createElement('h3');
  title.className = 'lec-card-title';
  title.textContent = item.company;
  card.appendChild(title);

  if (item.field) {
    const field = document.createElement('p');
    field.className = 'adv-field';
    field.textContent = item.field;
    card.appendChild(field);
  }

  if (item.role) {
    const role = document.createElement('p');
    role.className = 'adv-role';
    role.textContent = item.role;
    card.appendChild(role);
  }

  return card;
}

/* 메인 */
document.addEventListener('DOMContentLoaded', () => {
  const list = document.getElementById('advisory-list');
  if (!list) return;

  fetch('data/advisory.json')
    .then(res => { if (!res.ok) throw new Error(); return res.json(); })
    .then(data => {
      const items = Array.isArray(data.advisory) ? data.advisory : [];

      if (items.length === 0) {
        list.innerHTML = '<p class="lec-empty">등록된 경영자문 내역이 없습니다.</p>';
        return;
      }

      /* 연도 내림차순으로 그룹 키 정렬 */
      const years = [...new Set(items.map(it => it.year))].sort((a, b) => b - a);

      years.forEach(year => {
        const label = document.createElement('p');
        label.className = 'adv-year-label';
        label.textContent = String(year);
        list.appendChild(label);

        const group = items
          .filter(it => it.year === year)
          .sort((a, b) => {
            const oa = ADV_TYPE_ORDER[a.type] ?? 99;
            const ob = ADV_TYPE_ORDER[b.type] ?? 99;
            return oa - ob;
          });

        group.forEach(it => list.appendChild(renderAdvisoryCard(it)));
      });
    })
    .catch(() => {
      list.innerHTML = '<p class="lec-empty">경영자문 정보를 불러오지 못했습니다.</p>';
    });
});
