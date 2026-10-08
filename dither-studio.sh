#!/bin/bash
# Dither Studio — Linux launcher.
#
# Opens the app in its own window (no tabs, no address bar) using a Chromium
# browser in app mode, with its own profile under
# ${XDG_DATA_HOME:-~/.local/share}/dither-studio.
#
#   ./dither-studio.sh              # app window
#   DITHER_DRY_RUN=1 ./dither-studio.sh   # print the command instead
#
# Make it executable once: chmod +x dither-studio.sh
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$HERE/index.html"
DATA="${XDG_DATA_HOME:-$HOME/.local/share}/dither-studio"
PROFILE="$DATA/profile"

if [ ! -f "$APP" ]; then
  echo "Could not find index.html next to this launcher. Keep the files together."
  exit 1
fi

find_browser() {
  for name in google-chrome google-chrome-stable chromium chromium-browser brave-browser microsoft-edge microsoft-edge-stable; do
    if command -v "$name" >/dev/null 2>&1; then
      command -v "$name"
      return 0
    fi
  done
  return 1
}

URL="file://$(printf '%s' "$APP" | sed 's/ /%20/g')"
BROWSER="$(find_browser || true)"

if [ -n "$BROWSER" ]; then
  if [ -n "${DITHER_DRY_RUN:-}" ]; then
    echo "\"$BROWSER\" --app=\"$URL\" --user-data-dir=\"$PROFILE\""
    exit 0
  fi
  echo "Starting Dither Studio in its own window..."
  # A tarball or AppImage browser sometimes needs --no-sandbox; if the window
  # never appears, run it with DITHER_NO_SANDBOX=1 and read the guide.
  SANDBOX=""
  if [ -n "${DITHER_NO_SANDBOX:-}" ]; then SANDBOX="--no-sandbox"; fi
  "$BROWSER" --app="$URL" --user-data-dir="$PROFILE" --no-first-run \
    --no-default-browser-check $SANDBOX >/dev/null 2>&1 &
else
  if [ -n "${DITHER_DRY_RUN:-}" ]; then
    echo "xdg-open \"$APP\""
    exit 0
  fi
  echo "No Chromium-family browser found."
  echo "Opening Dither Studio in your default browser instead."
  xdg-open "$APP" >/dev/null 2>&1 &
fi
