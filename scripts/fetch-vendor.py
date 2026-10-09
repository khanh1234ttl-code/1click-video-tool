"""Prepare src-tauri/vendor/ for the release installer: Chromium, FFmpeg and the extension.

usage: python scripts/fetch-vendor.py [--platform win-x64|mac-arm64|mac-x64]
Archives are cached in vendor-dl/ and must match the pinned SHA256.
Windows: extraction needs 7-Zip (set SEVENZIP if it is not in C:\\Program Files\\7-Zip); then
    cargo tauri build --config src-tauri/tauri.bundle.conf.json
macOS (run on a Mac; uses hdiutil and ditto): see README "Build trên Mac".
"""
import argparse
import hashlib
import stat
import zipfile
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
    # --- Windows ---
    "ffmpeg": (
        "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n8.1-latest-win64-gpl-shared-8.1.zip",
        "4468dc0ee4b21db3c06acd8f2ff2b56a1d1ca752437199cd00c3d39b15e26644",
    ),
    "chromium": (
        "https://github.com/Hibbiki/chromium-win64/releases/download/v154.0.8037.98-r1689415/chrome.7z",
        "0580f7a55c9e1049499fbebe87f341212d62dd598434e2ebd8db6226f9417f19",
    ),
    # --- macOS (ungoogled-chromium 154 stable; FFmpeg 9.0.2 static with libx264, martin-riedl.de) ---
    "chromium-mac-arm64": (
        "https://github.com/ungoogled-software/ungoogled-chromium-macos/releases/download/154.0.8037.97-1.1/ungoogled-chromium_154.0.8037.97-1.1_arm64-macos.dmg",
        "43804c2115781fbadaa9fa4d19f1c3844cd5a9996efcb16a4bb3070f942e4586",
    ),
    "chromium-mac-x64": (
        "https://github.com/ungoogled-software/ungoogled-chromium-macos/releases/download/154.0.8037.97-1.1/ungoogled-chromium_154.0.8037.97-1.1_x86_64-macos.dmg",
        "5e11f07b72b11294fad266766dc640c34e91bd4fff92c6b75b65bac5a3718cf9",
    ),
    "ffmpeg-mac-arm64": (
        "https://ffmpeg.martin-riedl.de/download/macos/arm64/1789931890_9.0.2/ffmpeg.zip",
        "c8ed4c4e6978a03c485edbfe4e0a5dc2380f8a30bba5150531b31b094492d924",
    ),
    "ffprobe-mac-arm64": (
        "https://ffmpeg.martin-riedl.de/download/macos/arm64/1789931890_9.0.2/ffprobe.zip",
        "fcbe839537485eaee7a7a8bc5cbc0f90d53617e80943e8a5b2e31cb851197ea6",
    ),
    "ffmpeg-mac-x64": (
        "https://ffmpeg.martin-riedl.de/download/macos/amd64/1789931006_9.0.2/ffmpeg.zip",
        "7c6b4125b191cbf773832dc51f424cf2b6bb7da43007d1e066f95909e47cacd4",
    ),
    "ffprobe-mac-x64": (
        "https://ffmpeg.martin-riedl.de/download/macos/amd64/1789931006_9.0.2/ffprobe.zip",
        "2322438ed2f6319a691291b247d09c69dcaa3a982460d1f269a7e1af335cfdfd",
    ),
}

NOTICES_MAC = """1Click Video Tool — phần mềm bên thứ ba đi kèm bộ cài (macOS)

Chromium 154.0.8037.97 (thư mục chromium/Chromium.app)
  Mã nguồn mở của dự án Chromium (giấy phép BSD và các giấy phép bên thứ ba của Chromium),
  bản ungoogled-chromium cho macOS: https://github.com/ungoogled-software/ungoogled-chromium-macos

FFmpeg 9.0.2 (thư mục ffmpeg/)
  Giấy phép GNU GPL (bản build tĩnh có libx264). Mã nguồn: https://ffmpeg.org/ (bản 9.0.2),
  bản build: https://ffmpeg.martin-riedl.de/
  1Click Video Tool gọi ffmpeg/ffprobe như chương trình riêng, không liên kết thư viện.
"""

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


def copy_extension() -> None:
    shutil.copytree(EXTENSION_SRC, VENDOR / "extension", ignore=shutil.ignore_patterns("FIX_NOTES.txt", "*.bak"))


def report() -> None:
    for d in ("chromium", "ffmpeg", "extension"):
        size = sum(p.stat().st_size for p in (VENDOR / d).rglob("*") if p.is_file() and not p.is_symlink())
        print(f"{d}: {size / 1e6:.0f} MB")


def windows(staging: Path) -> None:
    extract(fetch("chromium"), staging / "chromium")
    shutil.copytree(staging / "chromium" / "Chrome-bin", VENDOR / "chromium")
    extract(fetch("ffmpeg"), staging / "ffmpeg")
    root = next((staging / "ffmpeg").iterdir())
    (VENDOR / "ffmpeg").mkdir()
    for f in (root / "bin").iterdir():
        if f.name in ("ffmpeg.exe", "ffprobe.exe") or f.suffix == ".dll":
            shutil.copy2(f, VENDOR / "ffmpeg" / f.name)
    shutil.copy2(root / "LICENSE.txt", VENDOR / "ffmpeg" / "LICENSE.txt")
    (VENDOR / "THIRD_PARTY_NOTICES.txt").write_text(NOTICES, encoding="utf-8")


def mac(arch: str, staging: Path) -> None:
    if sys.platform != "darwin":
        sys.exit("Bản macOS phải chuẩn bị trên máy Mac (cần hdiutil và ditto).")
    dmg = fetch(f"chromium-mac-{arch}")
    mount = staging / "mnt"
    mount.mkdir(parents=True)
    subprocess.run(["hdiutil", "attach", "-nobrowse", "-readonly", "-mountpoint", str(mount), str(dmg)], check=True, stdout=subprocess.DEVNULL)
    try:
        app = next(mount.glob("*.app"))
        (VENDOR / "chromium").mkdir()
        # ditto keeps the framework symlinks and code signature intact.
        subprocess.run(["ditto", str(app), str(VENDOR / "chromium" / "Chromium.app")], check=True)
    finally:
        subprocess.run(["hdiutil", "detach", str(mount)], check=False, stdout=subprocess.DEVNULL)
    (VENDOR / "ffmpeg").mkdir()
    for tool in ("ffmpeg", "ffprobe"):
        with zipfile.ZipFile(fetch(f"{tool}-mac-{arch}")) as z:
            z.extract(tool, VENDOR / "ffmpeg")
        exe = VENDOR / "ffmpeg" / tool
        exe.chmod(exe.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    (VENDOR / "THIRD_PARTY_NOTICES.txt").write_text(NOTICES_MAC, encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--platform", choices=["win-x64", "mac-arm64", "mac-x64"], default="win-x64")
    platform = ap.parse_args().platform
    if platform.startswith("mac") and sys.platform != "darwin":
        sys.exit("Bản macOS phải chuẩn bị trên máy Mac (cần hdiutil và ditto).")
    staging = CACHE / "staging"
    if staging.exists():
        shutil.rmtree(staging)
    if VENDOR.exists():
        shutil.rmtree(VENDOR)
    VENDOR.mkdir(parents=True)
    if platform == "win-x64":
        windows(staging)
    else:
        mac(platform.split("-")[1], staging)
    copy_extension()
    shutil.rmtree(staging, ignore_errors=True)
    report()


if __name__ == "__main__":
    main()
