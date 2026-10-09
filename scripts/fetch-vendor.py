"""Prepare src-tauri/vendor/ for the release installer: Chromium, FFmpeg and the extension.

usage: python scripts/fetch-vendor.py
Archives are cached in vendor-dl/ and must match the pinned SHA256. Extraction needs 7-Zip
(set SEVENZIP to 7z.exe if it is not in C:\\Program Files\\7-Zip). Build the installer with
    cargo tauri build --config src-tauri/tauri.bundle.conf.json
"""
import hashlib
import os
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "vendor-dl"
VENDOR = ROOT / "src-tauri" / "vendor"
EXTENSION_SRC = ROOT.parent / "Vids_Automation_1ClickStudio_v1.1.9.6"
SEVENZIP = os.environ.get("SEVENZIP", r"C:\Program Files\7-Zip\7z.exe")

ARCHIVES = {
    "ffmpeg": (
        "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n8.1-latest-win64-gpl-shared-8.1.zip",
        "4468dc0ee4b21db3c06acd8f2ff2b56a1d1ca752437199cd00c3d39b15e26644",
    ),
    "chromium": (
        "https://github.com/Hibbiki/chromium-win64/releases/download/v154.0.8037.98-r1689415/chrome.7z",
        "0580f7a55c9e1049499fbebe87f341212d62dd598434e2ebd8db6226f9417f19",
    ),
}

NOTICES = """1Click Video Tool — phần mềm bên thứ ba đi kèm bộ cài

Chromium 154.0.8037.98 (thư mục chromium/)
  Mã nguồn mở của dự án Chromium (giấy phép BSD và các giấy phép bên thứ ba của Chromium),
  https://www.chromium.org/ — bản build Windows của Hibbiki: https://github.com/Hibbiki/chromium-win64

FFmpeg 8.1 (thư mục ffmpeg/)
  Giấy phép GNU GPL v3 (bản build có libx264), xem ffmpeg/LICENSE.txt.
  Mã nguồn: https://ffmpeg.org/ — https://git.ffmpeg.org/ffmpeg.git (nhánh release/8.1),
  bản build: https://github.com/BtbN/FFmpeg-Builds
  1Click Video Tool gọi ffmpeg.exe/ffprobe.exe như chương trình riêng, không liên kết thư viện.
"""


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch(name: str) -> Path:
    url, digest = ARCHIVES[name]
    dest = CACHE / name / url.rsplit("/", 1)[1]
    if not dest.is_file() or sha256(dest) != digest:
        dest.parent.mkdir(parents=True, exist_ok=True)
        print(f"downloading {url}")
        urllib.request.urlretrieve(url, dest)
    if sha256(dest) != digest:
        sys.exit(f"SHA256 mismatch for {dest}")
    return dest


def extract(archive: Path, into: Path) -> None:
    if into.exists():
        shutil.rmtree(into)
    into.mkdir(parents=True)
    subprocess.run([SEVENZIP, "x", "-y", f"-o{into}", str(archive)], check=True, stdout=subprocess.DEVNULL)


def main() -> None:
    staging = CACHE / "staging"
    if VENDOR.exists():
        shutil.rmtree(VENDOR)
    VENDOR.mkdir(parents=True)

    extract(fetch("chromium"), staging / "chromium")
    shutil.copytree(staging / "chromium" / "Chrome-bin", VENDOR / "chromium")

    extract(fetch("ffmpeg"), staging / "ffmpeg")
    root = next((staging / "ffmpeg").iterdir())
    (VENDOR / "ffmpeg").mkdir()
    for f in (root / "bin").iterdir():
        if f.name in ("ffmpeg.exe", "ffprobe.exe") or f.suffix == ".dll":
            shutil.copy2(f, VENDOR / "ffmpeg" / f.name)
    shutil.copy2(root / "LICENSE.txt", VENDOR / "ffmpeg" / "LICENSE.txt")

    shutil.copytree(EXTENSION_SRC, VENDOR / "extension", ignore=shutil.ignore_patterns("FIX_NOTES.txt", "*.bak"))
    (VENDOR / "THIRD_PARTY_NOTICES.txt").write_text(NOTICES, encoding="utf-8")
    shutil.rmtree(staging)
    for d in ("chromium", "ffmpeg", "extension"):
        size = sum(p.stat().st_size for p in (VENDOR / d).rglob("*") if p.is_file())
        print(f"{d}: {size / 1e6:.0f} MB")


if __name__ == "__main__":
    main()
