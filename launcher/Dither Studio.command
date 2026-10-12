#!/bin/bash
# Dither Studio — macOS launcher.
#
# Double-click this file (or run it) to open the app in its own window: no
# tabs, no address bar, its own profile under
# ~/Library/Application Support/Dither Studio.
#
# Double-clicking runs this in Terminal, which closes again immediately.
# If Gatekeeper complains the first time: right-click → Open.
#
# Set DITHER_DRY_RUN=1 to print the command instead of running it.
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$HERE/index.html"
PROFILE="$HOME/Library/Application Support/Dither Studio/profile"

if [ ! -f "$APP" ]; then
  echo "Could not find index.html next to this launcher. Keep the files together."
  exit 1
fi

BROWSER=""
for candidate in \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" \
  "/Applications/Chromium.app/Contents/MacOS/Chromium"; do
  if [ -x "$candidate" ]; then
    BROWSER="$candidate"
    break
  fi
done

URL="file://$(printf '%s' "$APP" | sed 's/ /%20/g')"

if [ -n "$BROWSER" ]; then
  if [ -n "${DITHER_DRY_RUN:-}" ]; then
    echo "\"$BROWSER\" --app=\"$URL\" --user-data-dir=\"$PROFILE\""
    exit 0
  fi
  echo "Starting Dither Studio in its own window..."
  "$BROWSER" --app="$URL" --user-data-dir="$PROFILE" --no-first-run --no-default-browser-check >/dev/null 2>&1 &
else
  if [ -n "${DITHER_DRY_RUN:-}" ]; then
    echo "open \"$APP\""
    exit 0
  fi
  echo "Chrome, Edge, Brave and Chromium were not found."
  echo "Opening Dither Studio in your default browser instead."
  open "$APP"
fi
