#!/usr/bin/env python3
"""verify_post.py — 새 글 포스팅 실측 검증기 (chang-hongsung.com)

data/*.json 에 글을 추가한 뒤, 로컬 정적 서버를 띄우고 실제 브라우저로 열어
카드·썸네일·소제목·본문 그림(figure/figcaption)·모바일 레이아웃·콘솔 오류를
한 번에 확인한다. 눈으로 보는 확인을 대체하지 않고, 눈이 놓치기 쉬운 것을 잡는다.

사용법
    python scripts/verify_post.py 2026-08-16-giants-shoulders
    python scripts/verify_post.py 2026-08-16-giants-shoulders --shots tmp/shots
    python scripts/verify_post.py --page insights            # 글 지정 없이 페이지 전체만

글 id 를 주면 data/insights.json 과 data/life.json 에서 자동으로 찾아
해당 페이지(insights.html / life.html)를 연다.

종료 코드: 0 = 전부 통과, 1 = 실패 항목 있음, 2 = 인자/환경 오류

의존성: playwright (설치돼 있지 않으면 설치 방법을 안내하고 종료한다)
    python -m venv .venv-verify
    .venv-verify\\Scripts\\python -m pip install playwright
    .venv-verify\\Scripts\\python scripts/verify_post.py <글 id>
  크롬이 설치돼 있으면 별도 브라우저 내려받기 없이 그대로 쓴다.
"""

import argparse
import json
import re
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# 데이터 축 → 페이지. 두 페이지 모두 .ins-article-* 클래스를 공유한다.
PAGES = {
    "insights": ("data/insights.json", "insights.html"),
    "life": ("data/life.json", "life.html"),
}

VIEWPORTS = [(1280, 900, "desktop"), (375, 812, "mobile")]

IMG_RE = re.compile(r"^!\[([\s\S]*)\]\(([^)]+)\)$")

# 로컬 검증에서 나오는 것이 정상인 외부 요청.
#   supabase — 프로젝트 일시정지 상태(방문자 카운터)
#   google-analytics / googletagmanager — 로컬에서는 비컨이 끊기는 것이 정상
#   fonts.gstatic / fonts.googleapis — 웹폰트 서브셋은 페이지를 닫을 때 자주 취소된다
BENIGN_HOSTS = ("supabase.co", "google-analytics.com", "googletagmanager.com",
                "fonts.gstatic.com", "fonts.googleapis.com")
BENIGN_MSGS = ("Failed to fetch", "ERR_NAME_NOT_RESOLVED", "ERR_ABORTED",
               "Failed to load resource")


class Report:
    """검사 결과 누적기 — 실패해도 끝까지 돌려서 한 번에 다 보여 준다."""

    def __init__(self):
        self.failures = []
        self.passes = 0

    def check(self, ok: bool, label: str, detail: str = "") -> bool:
        tail = f"  ({detail})" if detail else ""
        if ok:
            self.passes += 1
            print(f"  OK   {label}{tail}")
        else:
            self.failures.append(f"{label}{tail}")
            print(f"  FAIL {label}{tail}")
        return ok

    def info(self, label: str, value) -> None:
        print(f"  ..   {label}: {value}")


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def start_server(port: int) -> subprocess.Popen:
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port),
         "--bind", "127.0.0.1", "--directory", str(REPO_ROOT)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    base = f"http://127.0.0.1:{port}/"
    for _ in range(50):  # 최대 5초 대기
        try:
            urllib.request.urlopen(base, timeout=1).read(1)
            return proc
        except urllib.error.HTTPError:
            return proc  # 응답이 오면 뜬 것
        except Exception:
            time.sleep(0.1)
    proc.terminate()
    raise RuntimeError(f"로컬 서버가 뜨지 않았습니다: {base}")


def find_article(article_id: str):
    """글 id 로 (페이지 키, 글 객체, 전체 글 목록) 을 찾는다."""
    for key, (data_rel, _) in PAGES.items():
        path = REPO_ROOT / data_rel
        if not path.is_file():
            continue
        articles = json.loads(path.read_text(encoding="utf-8")).get("articles", [])
        for art in articles:
            if art.get("id") == article_id:
                return key, art, articles
    return None, None, None


def expected_counts(article: dict) -> dict:
    """JSON 원본에서 기대되는 렌더 결과를 뽑는다."""
    subheads, images, paras = [], [], 0
    for text in article.get("paragraphs", []):
        if not isinstance(text, str):
            continue
        m = IMG_RE.match(text)
        if text.startswith("## "):
            subheads.append(text[3:].strip())
        elif m:
            images.append((m.group(1).strip(), m.group(2).strip()))
        else:
            paras += 1
    return {"subheads": subheads, "images": images, "paras": paras}


def wait_img(page, img):
    """loading="lazy" 라서 화면에 들어오기 전에는 안 뜬다 — 보이게 한 뒤 로드를 기다린다."""
    img.scroll_into_view_if_needed()
    try:
        img.evaluate("e => e.complete || new Promise(r => { e.onload = r; e.onerror = r; })")
    except Exception:
        pass
    page.wait_for_timeout(200)
    return img.evaluate("e => [e.naturalWidth, e.naturalHeight]")


def open_card(page, card):
    """카드 본문을 펼친다. 모바일에서는 토글 버튼이 숨겨져 헤더를 눌러야 한다."""
    btn = card.locator(".ins-article-toggle")
    if btn.is_visible():
        btn.click()
    else:
        card.locator(".ins-article-header").click()
    page.wait_for_timeout(400)


def verify_viewport(browser, url, width, height, tag, article, exp, rep, shots: Path):
    print(f"\n[{tag} {width}x{height}]")
    page = browser.new_page(viewport={"width": width, "height": height})
    console, netfail = [], []
    page.on("console", lambda m: console.append((m.type, m.text)) if m.type == "error" else None)
    page.on("pageerror", lambda e: console.append(("pageerror", str(e))))
    page.on("requestfailed", lambda r: netfail.append((r.url, r.failure)))

    page.goto(url, wait_until="networkidle")
    page.wait_for_selector(".ins-article-card")

    cards = page.locator(".ins-article-card")
    rep.info("렌더된 카드 수", cards.count())

    if article is None:
        rep.check(cards.count() > 0, "카드가 하나 이상 렌더됨")
        card = cards.first
    else:
        titles = cards.locator(".ins-article-title").all_inner_texts()
        title = article["title"]
        idx = titles.index(title) if title in titles else -1
        rep.check(idx >= 0, "대상 글이 목록에 있음", f"index={idx}")
        if idx < 0:
            page.close()
            return
        card = cards.nth(idx)

        thumb = card.locator(".ins-article-thumb")
        if article.get("thumb"):
            rep.check(thumb.count() == 1, "썸네일 <img> 렌더")
            src = thumb.get_attribute("src")
            rep.check(src == article["thumb"], "썸네일 경로 일치", src or "")
            rep.check((REPO_ROOT / article["thumb"]).is_file(),
                      "썸네일 파일 존재", article["thumb"])
            nat = wait_img(page, thumb)
            box = thumb.bounding_box() or {}
            rep.check(nat[0] > 0, "썸네일 이미지 로드됨", f"natural={nat[0]}x{nat[1]}")
            rep.info("썸네일 표시 크기", f'{box.get("width")}x{box.get("height")}')

        open_card(page, card)

        subheads = card.locator(".ins-article-subhead").all_inner_texts()
        rep.check(subheads == exp["subheads"], "소제목 렌더",
                  f"{len(subheads)}/{len(exp['subheads'])}개")

        rep.check(card.locator(".ins-article-paragraphs p").count() == exp["paras"],
                  "본문 문단 수 일치", f"기대 {exp['paras']}개")

        figs = card.locator(".ins-article-figure")
        rep.check(figs.count() == len(exp["images"]), "본문 그림 <figure> 수 일치",
                  f'{figs.count()}/{len(exp["images"])}개')
        for i, (caption, src) in enumerate(exp["images"]):
            fig = figs.nth(i)
            img = fig.locator("img")
            nat = wait_img(page, img)
            rep.check(img.get_attribute("src") == src, f"그림{i+1} 경로 일치", src)
            rep.check((REPO_ROOT / src).is_file(), f"그림{i+1} 파일 존재")
            rep.check(nat[0] > 0, f"그림{i+1} 이미지 로드됨", f"natural={nat[0]}x{nat[1]}")
            cap = fig.locator(".ins-article-figcaption")
            rep.check(cap.count() == 1 and cap.inner_text().strip() == caption,
                      f"그림{i+1} 설명글(figcaption) 부착")
            ibox, cbox = img.bounding_box() or {}, cap.bounding_box() or {}
            if ibox and cbox:
                rep.check(cbox["y"] >= ibox["y"] + ibox["height"] - 1,
                          f"그림{i+1} 설명글이 그림 아래에 위치")
                rep.check(ibox["width"] <= width,
                          f"그림{i+1} 폭이 화면을 넘지 않음",
                          f'{ibox["width"]:.0f}px')
            if shots:
                page.screenshot(path=str(shots / f"{tag}_figure{i+1}.png"))

    scroll_w, client_w = page.evaluate(
        "() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]")
    rep.check(scroll_w <= client_w, "가로 스크롤 없음", f"{scroll_w} vs {client_w}")

    unexpected_console = [c for c in console
                          if not any(b in c[1] for b in BENIGN_MSGS)]
    unexpected_net = [n for n in netfail
                      if not any(h in n[0] for h in BENIGN_HOSTS)]
    rep.check(not unexpected_console, "예상 밖 콘솔 오류 없음",
              "; ".join(f"{t}: {m[:80]}" for t, m in unexpected_console))
    # 같은 URL 이 여러 번 실패해도 한 줄로만 보여 준다.
    net_seen = list(dict.fromkeys(u for u, _ in unexpected_net))[:3]
    rep.check(not unexpected_net, "예상 밖 요청 실패 없음",
              "; ".join(u[:80] for u in net_seen))
    if console or netfail:
        rep.info("무시한 항목", f"콘솔 {len(console)}건 / 요청 {len(netfail)}건 (supabase·GA)")

    if shots:
        page.evaluate("() => window.scrollTo(0, 0)")   # 목록 최상단 모습으로 남긴다
        page.wait_for_timeout(200)
        page.screenshot(path=str(shots / f"{tag}.png"))
    page.close()


def main() -> int:
    p = argparse.ArgumentParser(
        description="새 글 포스팅 실측 검증 — 로컬 서버 + 실제 브라우저",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=("예시:\n"
                "  python scripts/verify_post.py 2026-08-16-giants-shoulders\n"
                "  python scripts/verify_post.py --page life\n"))
    p.add_argument("article_id", nargs="?", help="검증할 글 id (data/*.json 의 id)")
    p.add_argument("--page", choices=sorted(PAGES), help="글 id 없이 페이지만 검증")
    p.add_argument("--shots", metavar="DIR", help="스크린샷 저장 폴더")
    args = p.parse_args()

    if not args.article_id and not args.page:
        p.error("글 id 또는 --page 중 하나는 필요합니다.")

    try:
        from playwright.sync_api import sync_playwright
    except ModuleNotFoundError:
        print("오류: playwright 가 없습니다. 아래처럼 별도 가상환경에 설치해 쓰십시오.\n"
              "    python -m venv .venv-verify\n"
              "    .venv-verify\\Scripts\\python -m pip install playwright\n"
              "    .venv-verify\\Scripts\\python scripts/verify_post.py <글 id>",
              file=sys.stderr)
        return 2

    article = None
    exp = {"subheads": [], "images": [], "paras": 0}
    if args.article_id:
        page_key, article, articles = find_article(args.article_id)
        if article is None:
            print(f"오류: 글 id 를 찾지 못했습니다 — {args.article_id}", file=sys.stderr)
            return 2
        if args.page and args.page != page_key:
            print(f"오류: --page {args.page} 인데 글은 {page_key} 에 있습니다.", file=sys.stderr)
            return 2
        exp = expected_counts(article)
        newest = max(a.get("date", "") for a in articles)
    else:
        page_key, newest = args.page, None

    html = PAGES[page_key][1]
    shots = None
    if args.shots:
        shots = Path(args.shots)
        shots.mkdir(parents=True, exist_ok=True)

    port = free_port()
    server = start_server(port)
    url = f"http://127.0.0.1:{port}/{html}"
    rep = Report()

    print(f"대상: {html}  (글: {args.article_id or '지정 없음'})")
    if article:
        print(f"  기대값 — 소제목 {len(exp['subheads'])}개 / 본문 그림 {len(exp['images'])}개 "
              f"/ 문단 {exp['paras']}개")

    try:
        with sync_playwright() as pw:
            try:
                browser = pw.chromium.launch(channel="chrome")
            except Exception:
                browser = pw.chromium.launch()  # 설치된 크롬이 없으면 번들 크로미움
            try:
                for w, h, tag in VIEWPORTS:
                    verify_viewport(browser, url, w, h, tag, article, exp, rep, shots)
                if article and newest and article.get("date") == newest:
                    print()
                    page = browser.new_page(viewport={"width": 1280, "height": 900})
                    page.goto(url, wait_until="networkidle")
                    page.wait_for_selector(".ins-article-card")
                    first = page.locator(".ins-article-card").first
                    rep.check(first.locator(".ins-article-title").inner_text() == article["title"],
                              "최신 글이 목록 맨 위에 노출")
                    page.close()
            finally:
                browser.close()
    finally:
        server.terminate()

    print(f"\n요약: 통과 {rep.passes} / 실패 {len(rep.failures)}")
    if rep.failures:
        print("\n실패 목록:")
        for f in rep.failures:
            print(f"  - {f}")
        return 1
    print("이상 없음. 브라우저로 직접 한 번 더 눈으로 확인하시면 좋습니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
