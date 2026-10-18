#!/usr/bin/env bash
# Start an Android emulator and wait until it has booted (safe to re-run).
#
#   AVD_NAME=<avd> scripts/emulator/up.sh   start that AVD and wait
#   scripts/emulator/up.sh --list           only list the available AVDs
#
# Environment:
#   AVD_NAME         AVD to start; required when more than one AVD exists
#                    (with exactly one AVD, that one is used)
#   EMULATOR_PORT    console port (default 5554 -> device id emulator-5554)
#   BOOT_TIMEOUT     seconds to wait for boot (default 180)
#   EMULATOR_BIN / ADB_BIN   explicit tool paths
#   ANDROID_HOME / ANDROID_SDK_ROOT   Android SDK location
# On WSL without a Linux emulator, the Windows SDK in
# %LOCALAPPDATA%\Android\Sdk is used; the ADB server must already be running.
set -euo pipefail

EMULATOR_PORT="${EMULATOR_PORT:-5554}"
BOOT_TIMEOUT="${BOOT_TIMEOUT:-180}"
DEVICE_ID="emulator-$EMULATOR_PORT"

fail() {
  echo "emulator/up: $*" >&2
  exit 1
}
is_wsl() { grep -qi microsoft /proc/sys/kernel/osrelease 2>/dev/null; }

windows_sdk() {
  is_wsl && command -v cmd.exe >/dev/null 2>&1 || return 1
  local lad
  lad="$(cd / && cmd.exe /d /c 'echo %LOCALAPPDATA%' 2>/dev/null | tr -d '\r')"
  [[ -n "$lad" && "$lad" != "%LOCALAPPDATA%" ]] || return 1
  wslpath -u "$lad\\Android\\Sdk"
}

# find_tool <override-value> <sdk-subdir> <name>
find_tool() {
  local override="$1" sub="$2" name="$3" sdk win
  if [[ -n "$override" ]]; then
    command -v "$override" 2>/dev/null && return 0
    return 1
  fi
  for sdk in "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}"; do
    [[ -n "$sdk" && -x "$sdk/$sub/$name" ]] && {
      echo "$sdk/$sub/$name"
      return 0
    }
  done
  command -v "$name" 2>/dev/null && return 0
  win="$(windows_sdk)" || return 1
  [[ -f "$win/$sub/$name.exe" ]] && echo "$win/$sub/$name.exe"
}

EMULATOR="$(find_tool "${EMULATOR_BIN:-}" emulator emulator)" ||
  fail "Android emulator not found. Install it with Android Studio's SDK Manager, or set ANDROID_HOME or EMULATOR_BIN."

list_avds() {
  "$EMULATOR" -list-avds 2>/dev/null | tr -d '\r' | grep -E '^[A-Za-z0-9._-]+$' || true
}

if [[ "${1:-}" == "--list" ]]; then
  list_avds
  exit 0
fi

ADB="$(find_tool "${ADB_BIN:-}" platform-tools adb)" ||
  fail "adb not found. Install Android SDK platform-tools, or set ANDROID_HOME or ADB_BIN."

# Bound every adb call: a missing or remote ADB server can make adb hang.
adb() { timeout "${ADB_TIMEOUT:-15}" "$ADB" "$@"; }
adb devices >/dev/null 2>&1 ||
  fail "adb cannot reach an ADB server (timed out or failed). Start the ADB server, then re-run."

adb_devices() { adb devices 2>/dev/null | tr -d '\r'; }
device_ready() { adb_devices | grep -qE "^${DEVICE_ID}[[:space:]]+device$"; }
getprop() { adb -s "$DEVICE_ID" shell getprop "$1" 2>/dev/null | tr -d '\r'; }

if device_ready; then
  echo "Emulator $DEVICE_ID is already running ($(getprop ro.product.model))."
  exit 0
fi

AVDS="$(list_avds)"
[[ -n "$AVDS" ]] || fail "No AVDs found. Create one in Android Studio's Device Manager."
if [[ -z "${AVD_NAME:-}" ]]; then
  if [[ "$(wc -l <<<"$AVDS")" -ne 1 ]]; then
    {
      echo "emulator/up: several AVDs exist; choose one with AVD_NAME, e.g."
      echo "  AVD_NAME=<name> scripts/emulator/up.sh"
      echo "Available AVDs:"
      while IFS= read -r avd; do echo "  $avd"; done <<<"$AVDS"
    } >&2
    exit 2
  fi
  AVD_NAME="$AVDS"
fi
grep -qxF "$AVD_NAME" <<<"$AVDS" ||
  fail "AVD '$AVD_NAME' not found. Available: $(tr '\n' ' ' <<<"$AVDS")"

echo "==> Starting AVD $AVD_NAME on port $EMULATOR_PORT"
if [[ "$EMULATOR" == *.exe ]]; then
  # Windows emulator: launch through PowerShell so it outlives this shell.
  ps_quote() { printf "'%s'" "${1//\'/\'\'}"; }
  (cd / && powershell.exe -NoLogo -NoProfile -NonInteractive -Command \
    "Start-Process -FilePath $(ps_quote "$(wslpath -w "$EMULATOR")") -ArgumentList '-avd',$(ps_quote "$AVD_NAME"),'-port','$EMULATOR_PORT','-no-snapshot-load'" \
    >/dev/null 2>&1) || fail "Could not launch the Windows emulator."
else
  LOG="${TMPDIR:-/tmp}/emulator-$EMULATOR_PORT.log"
  nohup "$EMULATOR" -avd "$AVD_NAME" -port "$EMULATOR_PORT" -no-snapshot-load >"$LOG" 2>&1 &
  echo "    log: $LOG"
fi

echo "==> Waiting for boot (timeout ${BOOT_TIMEOUT}s)"
waited=0
until device_ready && [[ "$(getprop sys.boot_completed)" == "1" ]]; do
  ((waited >= BOOT_TIMEOUT)) && fail "$DEVICE_ID did not finish booting within ${BOOT_TIMEOUT}s."
  sleep 2
  waited=$((waited + 2))
done

echo "==> Ready: $DEVICE_ID ($AVD_NAME, $(getprop ro.product.model), Android $(getprop ro.build.version.release))"
echo "    Stop it with: scripts/emulator/down.sh"
