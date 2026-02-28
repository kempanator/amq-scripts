"""
Download AMQ client files
Version 0.1

File list can be grabbed with /copysource in mega commands when logged in to AMQ.
Once the list is in your clipboard, run this python script to download the files to the specified directory.
Only .js, .css, .html, and .json files are downloaded.
Download directory is cleared on each run.
"""

import argparse
import json
import os
import shutil
import sys
import tkinter
import urllib.parse
import urllib.request


DOWNLOAD_DIR = os.path.join(os.environ["USERPROFILE"], "Documents", "GitHub", "amq-client")
ALLOWED_EXTS = {".js", ".css", ".json", ".html"}


def normalize_urls(items):
    """Return unique, non-empty URL strings (ignores # comments)."""
    seen = set()
    urls = []
    for item in items:
        if item is None:
            continue
        raw = str(item).strip()
        if not raw or raw.startswith("#"):
            continue
        if raw in seen:
            continue
        seen.add(raw)
        urls.append(raw)
    return urls


def parse_urls_text(text):
    """Parse URLs from newline text or a JSON array string."""
    stripped = text.strip()
    if stripped.startswith("[") and stripped.endswith("]"):
        try:
            data = json.loads(stripped)
        except json.JSONDecodeError:
            data = None
        if isinstance(data, list):
            return normalize_urls(data)
    return normalize_urls(stripped.splitlines())


def try_read_clipboard_urls():
    """Return parsed URLs from clipboard when valid; otherwise empty list."""
    try:
        root = tkinter.Tk()
        root.withdraw()
        try:
            text = root.clipboard_get()
        finally:
            root.destroy()
    except Exception:
        return []
    return parse_urls_text(text)

def load_urls(input_path):
    """Load URLs from a file, urls.txt, stdin, clipboard, or interactive paste."""
    if input_path:
        with open(input_path, "r", encoding="utf-8") as handle:
            return parse_urls_text(handle.read())

    # Default to urls.txt in the same folder as this script.
    default_path = os.path.join(os.path.dirname(__file__), "urls.txt")
    if os.path.exists(default_path):
        with open(default_path, "r", encoding="utf-8") as handle:
            return parse_urls_text(handle.read())

    # If piped data exists, prefer it over interactive input.
    if sys.stdin and not sys.stdin.isatty():
        return parse_urls_text(sys.stdin.read())

    clipboard_urls = try_read_clipboard_urls()
    if clipboard_urls:
        return clipboard_urls

    print("No input file found. Paste URLs (one per line), then press Enter on an empty line:")
    lines = []
    while True:
        try:
            line = input()
        except EOFError:
            break
        if not line.strip():
            break
        lines.append(line)
    return parse_urls_text("\n".join(lines))


def is_allowed_rel(rel_path):
    """Return True when the path has a supported extension."""
    lower = rel_path.lower()
    return any(lower.endswith(ext) for ext in ALLOWED_EXTS)


def safe_rel_path(path):
    """Convert a URL path to a safe relative filesystem path."""
    rel = os.path.normpath(path.lstrip("/\\"))
    if rel.startswith("..") or os.path.isabs(rel):
        return None
    return rel


def resolve_rel_path(url_path):
    """Convert URL path to a relative path, defaulting root to index.html."""
    if url_path in {"", "/"}:
        return "index.html"
    return safe_rel_path(url_path)


def should_prettify_json(rel_path):
    """Return True when rel_path should be pretty-printed."""
    if not rel_path.lower().endswith(".json"):
        return False
    rel_norm = rel_path.replace("\\", "/").lower().strip("/")
    rel_with_guards = f"/{rel_norm}/"
    return "/locales/" in rel_with_guards


def prettify_json_file(path):
    """Pretty-print JSON file with stable defaults; return True when updated."""
    with open(path, "r", encoding="utf-8") as handle:
        data = json.load(handle)
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
    return True


def download_url(url, dest_path, overwrite=False):
    """Download URL to dest_path; optionally skip when file exists."""
    if not overwrite and os.path.exists(dest_path):
        return "skipped"

    # Ensure parent directories exist before writing the file.
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "amq-client-downloader/1.0"})
    with urllib.request.urlopen(req) as resp, open(dest_path, "wb") as out:
        out.write(resp.read())
    return "downloaded"


def clear_download_dir():
    """Remove all contents except .git and .gitignore."""
    if not os.path.isdir(DOWNLOAD_DIR):
        return
    for entry in os.listdir(DOWNLOAD_DIR):
        if entry in {".git", ".gitignore"}:
            continue
        path = os.path.join(DOWNLOAD_DIR, entry)
        if os.path.isdir(path):
            shutil.rmtree(path)
        else:
            os.remove(path)


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Download .js/.css/.json/.html assets into a mirrored folder structure."
    )
    parser.add_argument(
        "--input",
        help="Path to a text file containing URLs (default: urls.txt in this folder).",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip files that already exist (default is to overwrite).",
    )
    args = parser.parse_args()

    urls = load_urls(args.input)
    if not urls:
        print("No URLs provided.")
        return 1

    clear_download_dir()

    downloaded = 0
    skipped = 0
    ignored = 0

    for url in urls:
        parsed = urllib.parse.urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            # Skip non-absolute or malformed entries.
            ignored += 1
            continue

        rel = resolve_rel_path(parsed.path)
        if not rel:
            # Guard against unsafe or absolute paths.
            ignored += 1
            continue

        if not is_allowed_rel(rel):
            # Only keep .js/.css/.json/.html files.
            ignored += 1
            continue

        # Mirror URL path under DOWNLOAD_DIR.
        dest_path = os.path.join(DOWNLOAD_DIR, rel)
        try:
            status = download_url(url, dest_path, overwrite=not args.skip_existing)
        except Exception as exc:
            print(f"Failed: {url} ({exc})")
            ignored += 1
            continue

        if status == "downloaded":
            downloaded += 1
            print(f"Downloaded: {url}")
            if should_prettify_json(rel):
                try:
                    prettify_json_file(dest_path)
                except Exception as exc:
                    # Keep the raw file when parsing or re-write fails.
                    print(f"Warn: JSON format skipped for {dest_path} ({exc})")
        else:
            skipped += 1
            print(f"Skipped (exists): {dest_path}")

    print(f"Done. downloaded={downloaded} skipped={skipped} ignored={ignored}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
