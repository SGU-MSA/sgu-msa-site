#!/usr/bin/env bash
# Stop the Android emulator started by scripts/emulator/up.sh (safe to re-run).
# Environment: EMULATOR_PORT (default 5554), ADB_BIN, ANDROID_HOME /
# ANDROID_SDK_ROOT. On WSL, falls back to the Windows SDK's adb.exe.
set -euo pipefail

EMULATOR_PORT="${EMULATOR_PORT:-5554}"
DEVICE_ID="emulator-$EMULATOR_PORT"

fail() {
  echo "emulator/down: $*" >&2
  exit 1
}

find_adb() {
  local sdk lad
  if [[ -n "${ADB_BIN:-}" ]]; then
    command -v "$ADB_BIN" 2>/dev/null
    return
  fi
  for sdk in "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}"; do
    [[ -n "$sdk" && -x "$sdk/platform-tools/adb" ]] && {
      echo "$sdk/platform-tools/adb"
      return 0
    }
  done
  command -v adb 2>/dev/null && return 0
  grep -qi microsoft /proc/sys/kernel/osrelease 2>/dev/null || return 1
  command -v cmd.exe >/dev/null 2>&1 || return 1
  lad="$(cd / && cmd.exe /d /c 'echo %LOCALAPPDATA%' 2>/dev/null | tr -d '\r')"
  [[ -n "$lad" && "$lad" != "%LOCALAPPDATA%" ]] || return 1
  lad="$(wslpath -u "$lad\\Android\\Sdk\\platform-tools\\adb.exe")"
  [[ -f "$lad" ]] && echo "$lad"
}

ADB="$(find_adb)" || fail "adb not found. Set ANDROID_HOME or ADB_BIN."
# Bound every adb call: a missing or remote ADB server can make adb hang.
adb() { timeout "${ADB_TIMEOUT:-15}" "$ADB" "$@"; }
adb devices >/dev/null 2>&1 ||
  fail "adb cannot reach an ADB server (timed out or failed). Start the ADB server, then re-run."

running() { adb devices 2>/dev/null | tr -d '\r' | grep -q "^${DEVICE_ID}[[:space:]]"; }

if ! running; then
  echo "No emulator running on $DEVICE_ID."
  exit 0
fi

echo "Stopping $DEVICE_ID..."
adb -s "$DEVICE_ID" emu kill >/dev/null 2>&1 || true

waited=0
while running; do
  if ((waited >= 30)); then
    echo "Warning: $DEVICE_ID did not stop within 30s." >&2
    exit 1
  fi
  sleep 2
  waited=$((waited + 2))
done
echo "Emulator stopped."
