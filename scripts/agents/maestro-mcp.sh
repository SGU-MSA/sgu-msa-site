#!/usr/bin/env bash
# Starts the Maestro MCP server (stdio) for this repo. Used by .mcp.json and
# the generated .codex/config.toml; it is not meant to be run by hand.
#
# Finds Maestro in this order:
#   1. $MAESTRO_BIN (path or command name), else `maestro` on PATH
#   2. On WSL only: a Windows install found with `where maestro`
# Maestro's own launcher finds Java (JAVA_HOME or `java` on PATH).
# Stdout is the MCP channel, so every message here goes to stderr.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"

export MAESTRO_CLI_NO_ANALYTICS=true
export MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true

die() {
  echo "maestro-mcp: $*" >&2
  exit 127
}

is_wsl() { grep -qi microsoft /proc/sys/kernel/osrelease 2>/dev/null; }

# 1. Linux / macOS / WSL-native Maestro.
if MAESTRO="$(command -v "${MAESTRO_BIN:-maestro}" 2>/dev/null)"; then
  exec "$MAESTRO" mcp --working-dir="$PROJECT_DIR" "$@"
fi

# 2. WSL fallback: Maestro installed on the Windows side.
if is_wsl && command -v cmd.exe >/dev/null 2>&1; then
  # cmd.exe warns when started from a WSL (UNC) directory; run it from the
  # Windows temp directory, which is local and writable.
  win_temp="$(cmd.exe /d /c 'echo %TEMP%' 2>/dev/null | tr -d '\r' || true)"
  win_maestro="$(cmd.exe /d /c 'where maestro' 2>/dev/null | tr -d '\r' | head -n 1 || true)"
  if [[ -n "$win_maestro" && -n "$win_temp" ]]; then
    cd -- "$(wslpath -u "$win_temp")"
    export WSLENV="${WSLENV:+$WSLENV:}MAESTRO_CLI_NO_ANALYTICS:MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED"
    exec cmd.exe /d /c "$win_maestro" mcp "--working-dir=$(wslpath -w "$PROJECT_DIR")" "$@"
  fi
fi

die "Maestro is not installed (or not on PATH). Install it from https://maestro.dev, or set MAESTRO_BIN to its launcher."
