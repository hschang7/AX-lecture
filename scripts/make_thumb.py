#!/usr/bin/env python3
"""make_thumb.py — 카드 썸네일 생성기 (chang-hongsung.com)

이미지 URL 또는 로컬 경로를 받아 정사각 센터 크롭 → 256x256 → WebP(quality=82)로
images/thumbs/ 에 저장한다.

사용법
    python scripts/make_thumb.py <url|path> <YYYY-MM-DD-slug> [--force]
    python scripts/make_thumb.py --from-mapping <매핑.json> [--force]

매핑 JSON은 [{ "id": ..., "thumb": "images/thumbs/<id>.webp", "source_url": ... }, ...] 형태.

의존성: Pillow (그 외는 표준 라이브러리만 사용 — 순수 정적 사이트에 빌드 단계를 늘리지 않는다)
"""

import argparse
import io
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
THUMB_DIR = REPO_ROOT / "images" / "thumbs"

SLUG_RE = re.compile(r"^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$")
SIZE = 256
QUALITY = 82
TIMEOUT = 30
# 힉스필드 등 CDN은 기본 python UA를 403으로 막는 경우가 있다.
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")


def fetch_bytes(src: str) -> bytes:
    """URL이면 다운로드, 아니면 로컬 파일을 읽는다. 전송 오류는 1회 재시도."""
    if not src.startswith(("http://", "https://")):
        path = Path(src)
        if not path.is_absolute():
            path = (REPO_ROOT / path).resolve()
        if not path.is_file():
            raise FileNotFoundError(f"로컬 파일 없음: {path}")
        return path.read_bytes()

    req = urllib.request.Request(src, headers={"User-Agent": UA})
    last_err = None
    for attempt in (1, 2):
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            # 4xx/5xx는 재시도해도 같다 — 응답 코드를 그대로 올린다.
            raise RuntimeError(f"HTTP {e.code} {e.reason}") from e
        except Exception as e:  # 타임아웃·연결 끊김 등 일시 오류만 재시도
            last_err = e
            if attempt == 2:
                raise RuntimeError(f"{type(e).__name__}: {e}") from e
    raise RuntimeError(str(last_err))


def make_thumb(raw: bytes, dest: Path) -> tuple[int, int, int]:
    """정사각 센터 크롭 → 256x256 → WebP 저장. (원본 W, 원본 H, 파일 크기) 반환."""
    img = Image.open(io.BytesIO(raw))
    img.load()
    src_w, src_h = img.size

    if img.mode not in ("RGB", "RGBA"):
        # P(팔레트)·CMYK·L 등은 변환. 투명도가 있으면 알파를 살린다(WebP 지원).
        img = img.convert("RGBA" if "A" in img.getbands() else "RGB")

    side = min(src_w, src_h)
    left = (src_w - side) // 2
    top = (src_h - side) // 2
    img = img.crop((left, top, left + side, top + side))
    img = img.resize((SIZE, SIZE), Image.LANCZOS)

    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "WEBP", quality=QUALITY, method=6)
    return src_w, src_h, dest.stat().st_size


def kb(n: int) -> str:
    return f"{n / 1024:.1f} KB"


def run_single(src: str, slug: str, force: bool) -> int:
    if not SLUG_RE.match(slug):
        print(f"오류: slug 형식 위반 — '{slug}' (기대: YYYY-MM-DD-소문자-하이픈)", file=sys.stderr)
        return 2

    dest = THUMB_DIR / f"{slug}.webp"
    if dest.exists() and not force:
        print(f"오류: 이미 있음 — {dest.relative_to(REPO_ROOT).as_posix()} (덮어쓰려면 --force)",
              file=sys.stderr)
        return 2

    try:
        raw = fetch_bytes(src)
        w, h, size = make_thumb(raw, dest)
    except Exception as e:
        print(f"실패: {e}", file=sys.stderr)
        return 1

    rel = dest.relative_to(REPO_ROOT).as_posix()
    print(f"저장 완료: {rel}")
    print(f"  원본 {w}x{h} → {SIZE}x{SIZE} WebP(quality={QUALITY}), {kb(size)}")
    print(f"\n  data JSON에 붙여넣을 줄:\n    \"thumb\": \"{rel}\",")
    return 0


def run_batch(mapping_path: Path, force: bool) -> int:
    try:
        items = json.loads(mapping_path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"오류: 매핑 파일을 읽을 수 없음 — {e}", file=sys.stderr)
        return 2
    if not isinstance(items, list) or not items:
        print("오류: 매핑 파일은 비어 있지 않은 배열이어야 합니다.", file=sys.stderr)
        return 2

    total = len(items)
    width = len(str(total))
    ok = skipped = failed = 0
    failures = []

    for i, item in enumerate(items, 1):
        tag = f"[{i:>{width}}/{total}]"
        item_id = item.get("id", "?")
        thumb = item.get("thumb", "")
        src = item.get("source_url", "")

        # thumb 경로·slug 검증 — 오타 파일명이 저장소에 남지 않게 한다.
        if not thumb.startswith("images/thumbs/") or not thumb.endswith(".webp"):
            failures.append((item_id, "thumb 경로 형식 위반"))
            print(f"{tag} FAIL  {item_id}  ← thumb 경로 형식 위반: {thumb!r}")
            failed += 1
            continue
        slug = thumb[len("images/thumbs/"):-len(".webp")]
        if not SLUG_RE.match(slug):
            failures.append((item_id, f"slug 형식 위반: {slug}"))
            print(f"{tag} FAIL  {item_id}  ← slug 형식 위반")
            failed += 1
            continue
        if not src:
            failures.append((item_id, "source_url 없음"))
            print(f"{tag} FAIL  {item_id}  ← source_url 없음")
            failed += 1
            continue

        dest = REPO_ROOT / thumb
        if dest.exists() and not force:
            print(f"{tag} SKIP  {slug}.webp  (이미 있음)")
            skipped += 1
            continue

        try:
            raw = fetch_bytes(src)
            w, h, size = make_thumb(raw, dest)
        except Exception as e:
            failures.append((item_id, str(e)))
            print(f"{tag} FAIL  {slug}  ← {e}")
            failed += 1
            continue

        print(f"{tag} OK    {slug}.webp  원본 {w}x{h} → {SIZE}x{SIZE}  {kb(size)}")
        ok += 1

    print(f"\n요약: 성공 {ok} / 스킵 {skipped} / 실패 {failed}  (전체 {total})")
    if failures:
        print("\n실패 목록:")
        for item_id, reason in failures:
            print(f"  - {item_id}: {reason}")
        return 1
    return 0


def main() -> int:
    p = argparse.ArgumentParser(
        description="카드 썸네일 생성 — 정사각 센터 크롭 → 256x256 WebP",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=("예시:\n"
                "  python scripts/make_thumb.py https://cdn.example/a.png 2026-07-26-my-slug\n"
                "  python scripts/make_thumb.py images/Hongsung.jpg 2026-07-26-my-slug\n"
                "  python scripts/make_thumb.py --from-mapping 썸네일_매핑_20260727.json\n"))
    p.add_argument("source", nargs="?", help="이미지 URL 또는 로컬 경로")
    p.add_argument("slug", nargs="?", help="YYYY-MM-DD-slug (소문자·하이픈)")
    p.add_argument("--from-mapping", metavar="JSON", help="매핑 JSON 전체를 일괄 처리")
    p.add_argument("--force", action="store_true", help="기존 파일 덮어쓰기")
    args = p.parse_args()

    if args.from_mapping:
        if args.source or args.slug:
            p.error("--from-mapping 은 단건 인자와 함께 쓸 수 없습니다.")
        return run_batch(Path(args.from_mapping), args.force)

    if not args.source or not args.slug:
        p.error("단건 모드는 <url|path> 와 <YYYY-MM-DD-slug> 두 인자가 필요합니다.")
    return run_single(args.source, args.slug, args.force)


if __name__ == "__main__":
    sys.exit(main())
