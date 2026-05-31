"""
Download AMQ client files
Version 0.4

Builds the file list from live source maps, then mirrors scripts, css, locales,
and login.html into the amq-client repo.

game.html and maintenance.html must be updated manually.
Download directory is cleared on each run (README.md, game.html, and maintenance.html are kept).
"""

import json
import os
import shutil
import urllib.error
import urllib.parse
import urllib.request


BASE_URL = "https://animemusicquiz.com"
DOWNLOAD_DIR = os.path.join(os.environ["USERPROFILE"], "Documents", "GitHub", "amq-client")

SOURCE_MAP_PATHS = (
    "/bundles/gamePage.js.map",
    "/bundles/gamePage.css.map",
    "/bundles/loginPage.js.map",
    "/bundles/loginPage.css.map",
)

# Web Worker entry points are not included in bundle source maps.
EXTRA_SOURCE_PATHS = (
    "/scripts/pages/gamePage/library/librarySearchIndexCalculator.js",
)

LOCALE_CODES = (
    "en",      # English
    "ca",      # Catalan
    "zh-Hant", # Chinese (Traditional)
    "id",      # Indonesian
    "ja",      # Japanese
    "ko",      # Korean
    "nb",      # Norwegian Bokmål
    "es-ES",   # Spanish (Spain)
    "vi",      # Vietnamese
)

CLEAR_PRESERVE_FILES_LOWER = {"readme.md", "game.html", "maintenance.html"}
USER_AGENT = "amq-client-downloader"


def normalize_source_path(path):
    """Normalize a map source path to a safe relative URL path."""
    path = path.replace("\\", "/").strip()
    if not path:
        return None
    if not path.startswith("/"):
        path = "/" + path
    rel = os.path.normpath(path.lstrip("/"))
    if rel.startswith("..") or os.path.isabs(rel):
        return None
    return rel.replace("\\", "/")


def safe_rel_path(url_path):
    """Convert a URL path to a safe relative filesystem path."""
    if url_path in {"", "/"}:
        return "login.html"
    rel = os.path.normpath(url_path.lstrip("/\\"))
    if rel.startswith("..") or os.path.isabs(rel):
        return None
    return rel.replace("\\", "/")


def fetch_json(url):
    """Fetch and parse JSON from url."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)


def collect_source_paths():
    """Fetch all source maps and return deduplicated relative paths."""
    seen = set()
    paths = []

    def add_path(source_path):
        rel = normalize_source_path(source_path)
        if not rel or rel in seen:
            return
        seen.add(rel)
        paths.append(rel)

    for map_path in SOURCE_MAP_PATHS:
        map_url = urllib.parse.urljoin(BASE_URL, map_path)
        print(f"Reading source map: {map_url}")
        source_map = fetch_json(map_url)
        sources = source_map.get("sources") or []
        if not isinstance(sources, list):
            raise ValueError(f"Invalid sources in {map_url}")
        for source in sources:
            if isinstance(source, str):
                add_path(source)

    for extra_path in EXTRA_SOURCE_PATHS:
        add_path(extra_path)

    for locale_code in LOCALE_CODES:
        add_path(f"/locales/{locale_code}.json")

    return paths


def should_prettify_json(rel_path):
    """Return True when rel_path should be pretty-printed."""
    rel_norm = rel_path.replace("\\", "/").lower().strip("/")
    return rel_norm.startswith("locales/") and rel_norm.endswith(".json")


def prettify_json_file(path):
    """Pretty-print JSON file with stable defaults."""
    with open(path, "r", encoding="utf-8") as handle:
        data = json.load(handle)
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def download_url(url, dest_path, overwrite=True):
    """Download url to dest_path; optionally skip when file exists."""
    if not overwrite and os.path.exists(dest_path):
        return "skipped"

    parent = os.path.dirname(dest_path)
    if parent:
        os.makedirs(parent, exist_ok=True)

    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req) as resp, open(dest_path, "wb") as out:
        out.write(resp.read())
    return "downloaded"


def clear_download_dir():
    """Remove all contents except git metadata and manually maintained files."""
    if not os.path.isdir(DOWNLOAD_DIR):
        return

    for entry in os.listdir(DOWNLOAD_DIR):
        if entry in {".git", ".gitignore"}:
            continue
        path = os.path.join(DOWNLOAD_DIR, entry)
        if os.path.isfile(path) and entry.lower() in CLEAR_PRESERVE_FILES_LOWER:
            continue
        try:
            if os.path.isdir(path):
                shutil.rmtree(path)
            else:
                os.remove(path)
        except PermissionError as exc:
            print(f"Warn: could not remove {path} ({exc})")


def download_path(rel_path, overwrite=True):
    """Download one mirrored asset path under DOWNLOAD_DIR."""
    if rel_path == "login.html":
        url = BASE_URL + "/"
    else:
        url = urllib.parse.urljoin(BASE_URL + "/", rel_path)

    dest_path = os.path.join(DOWNLOAD_DIR, rel_path.replace("/", os.sep))
    status = download_url(url, dest_path, overwrite=overwrite)
    if status == "downloaded" and should_prettify_json(rel_path):
        prettify_json_file(dest_path)
    return status


def main():
    """CLI entry point."""
    clear_download_dir()

    try:
        source_paths = collect_source_paths()
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError, ValueError) as exc:
        print(f"Failed to read source maps: {exc}")
        return 1

    download_paths = list(source_paths)
    if "login.html" not in download_paths:
        download_paths.append("login.html")

    print(f"Downloading {len(download_paths)} unique files into {DOWNLOAD_DIR}")

    downloaded = 0
    failed = 0

    for rel_path in download_paths:
        try:
            download_path(rel_path, overwrite=True)
        except Exception as exc:
            failed += 1
            url = BASE_URL + "/" if rel_path == "login.html" else urllib.parse.urljoin(BASE_URL + "/", rel_path)
            print(f"Failed: {url} ({exc})")
            continue

        downloaded += 1
        print(f"Downloaded: {rel_path}")

    print(f"Done. downloaded={downloaded} failed={failed}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
