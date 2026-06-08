# CLAUDE.md — chang-hongsung.com (ax-lecture)

> 본 파일은 **코드 저장소(`C:\Projects\ax-lecture`, GitHub `hschang7/AX-lecture`)의 스탠딩 컨텍스트**다. Claude Code 세션 시작 시 자동으로 읽히며, 코드 작성·실행 중 클과장의 행동 규약을 담는다.
>
> **⚠️ 단일 진실원천 — 운영·기억은 코웍 MEMORY.md** (협업원칙 v1.1 §9.3 메모리 사일로 방지)
> 사이트 운영 현황·콘텐츠 계획·의사결정·핸드오버는 코웍 작업공간
> `C:\Cowork\Cowork_업무\개인 웹 사이트 구축 및 운영\MEMORY.md` 를 단일 진실원천으로 한다.
> 사이트 콘텐츠의 진실원천은 Google Drive `AX-site-info-v3.md`.
> 본 파일은 **코드 관련 컨벤션만** 둔다. 운영·기억 정보를 본 파일에 중복 누적하지 않는다.
>
> **협업 모델 (코웍 + 클로드 코드)** — 코웍(두뇌, *무엇을·왜*) + 클로드 코드(손, *어떻게·어디서*). 코웍이 초안·변경 사양·핸드오버를 직접 작성하고, 클로드 코드는 파일 경로로 참조한다. 횡단 원칙: `C:\Cowork\Cowork_업무\클과장-클로드코드-코웍_협업_운영원칙_v1_1.md`.

---

## 1. 사이트 한 줄

> **chang-hongsung.com — "장홍성의 AX 공간"**. SK텔레콤 임원 경력 + 현재 중소기업 AX 컨설팅/PoC 활동 기반의 1인칭 개인 브랜딩 사이트. 주 콘텐츠는 AI·AX 인사이트, 보조 콘텐츠는 인생 소회·지혜.

상세 사이트 정보·콘텐츠 전략·로드맵은 코웍 `MEMORY.md` 참조.

---

## 2. 호칭 규약

- 사람 = **장홍성** (또는 *홍성님*)
- AI = **클과장** (Claude·클로드·어시스턴트 같은 일반명 사용 금지)

코드 주석·커밋 메시지·문서 어디에서도 일관 적용한다.

---

## 3. 기술 스택

| 항목 | 결정 |
|------|------|
| 구조 | **순수 정적 HTML + CSS + JS** (Astro·번들러·빌드 단계 없음 — 파일이 곧 사이트) |
| 호스팅 | GitHub Pages (자동 배포) |
| 도메인/DNS | chang-hongsung.com (Cloudflare Registrar) + CNAME |
| 데이터 | `data/*.json` (insights · lectures · life) |

---

## 4. 디렉토리 구조

```
ax-lecture/
├── index.html · about.html · lectures.html · insights.html · life.html
├── css/style.css
├── js/        # insights · lectures · life
├── data/      # insights · lectures · life (.json)
├── images/    # 프로필·OG 이미지
├── share/     # 개인 글 마크다운
├── CNAME · favicon.svg · README.md
└── CLAUDE.md  # 이 파일
```

---

## 5. 작업 자세

- **한국어 우선**, 영어 용어 처음 등장 시 괄호 병기.
- **비개발자 친화 설명**: 개념 → 최소 동작 코드 → 상세 설명 순서.
- **빌드 없음**: HTML/CSS/JS·JSON을 직접 편집하면 곧 사이트에 반영된다. 변경 후 **브라우저로 직접 확인**(데스크톱+모바일), 실제 배포는 git push 시 GitHub Pages 자동 반영.
- **콘텐츠 업로드 흐름**: 코웍 초안 → docx/md → 클로드 코드로 `data/*.json` 또는 HTML 추가 → git push → 자동 배포.
- **변경 후 검증 절차 동봉**: 모든 변경 보고에 홍성님이 직접 확인 가능한 절차를 동봉한다(예: "/insights.html 접속 → 새 글 카드 노출 확인").

---

## 6. 콘텐츠 원칙

- 글은 **홍성님 1인칭 목소리** 보존. 사실관계·경험은 임의 각색 금지 — 변경 필요 시 보고 후 승인.
- 사이트 콘텐츠 변경은 Drive 진실원천(`AX-site-info-v3.md`)과 동기화 유지.
- 민감 정보(이사회 관련 기업 등)는 포함하지 않는다.

---

## 변경 이력

- **v1.0 (2026-06-07)** : 최초 작성. 코웍 + 클로드 코드 협업 체계 전환에 맞춰 코드 저장소 컨텍스트로 신설. 운영·기억 단일원천을 코웍 `개인 웹 사이트 구축 및 운영\MEMORY.md`로 지정(메모리 사일로 방지), 사이트 콘텐츠 원천은 Drive `AX-site-info-v3.md`.
- **v1.1 (2026-06-08)** : 사이트 구조 개편. 커뮤니티(Supabase 백엔드 포함) 섹션 제거, 인사이트의 추천 도서·자료 및 인터뷰 섹션 제거, 신규 **삶 이야기**(`life.html` · `data/life.json` · `js/life.js`) 섹션 추가(인사이트형 글 목록, 커뮤니티 메뉴 자리 교체). 삭제 파일: community.html · resources.html · js/{community,supabase-config,resources}.js · data/{interviews,recommendations}.json. css/style.css의 `.comm-*` 스타일은 미사용으로 잔존(추후 정리 가능).
