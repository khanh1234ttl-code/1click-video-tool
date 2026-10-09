#!/bin/bash
# Build 1Click Video Tool for macOS without an Apple developer account (local use only).
# usage: bash scripts/build-mac.sh [arm64|x64]      (default: this Mac's architecture)
# Needs: Xcode command line tools, Rust, Node.js, Python 3.
set -euo pipefail
cd "$(dirname "$0")/.."

ARCH="${1:-$(uname -m | sed 's/x86_64/x64/')}"
case "$ARCH" in arm64|x64) ;; *) echo "Kiến trúc không hỗ trợ: $ARCH" >&2; exit 1 ;; esac

npm install
cargo tauri --version >/dev/null 2>&1 || cargo install tauri-cli --version "^2" --locked
python3 scripts/fetch-vendor.py --platform "mac-$ARCH"
cargo tauri build --bundles app --config src-tauri/tauri.bundle.mac.conf.json

APP="src-tauri/target/release/bundle/macos/1Click Video Tool.app"
# Resources copied by the bundler may break Chromium's signature; re-sign everything ad hoc
# (no Apple account) so Apple Silicon runs it, innermost code first.
codesign --force --deep --sign - "$APP/Contents/Resources/chromium/Chromium.app"
for tool in ffmpeg ffprobe; do codesign --force --sign - "$APP/Contents/Resources/ffmpeg/$tool"; done
codesign --force --sign - "$APP"
codesign --verify --deep "$APP" && echo "Đã ký tạm (ad hoc): $APP"

DMG="src-tauri/target/release/bundle/1Click-Video-Tool-$ARCH.dmg"
rm -f "$DMG"
hdiutil create -volname "1Click Video Tool" -srcfolder "$APP" -ov -format UDZO "$DMG"
echo "Bộ cài: $DMG"
echo "Cài: kéo app vào Applications, rồi chạy một lần:"
echo "  xattr -dr com.apple.quarantine \"/Applications/1Click Video Tool.app\""
