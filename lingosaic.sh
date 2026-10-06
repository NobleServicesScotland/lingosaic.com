#!/usr/bin/env bash
set -euo pipefail
LINGO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$LINGO_ROOT"
LINGO_RUN="$LINGO_ROOT/.lingosaic-run"
mkdir -p "$LINGO_RUN"
exec 9>"$LINGO_RUN/control.lock"
flock -n 9 || { echo "Another Lingosaic operation is running."; exit 1; }
managed_running() {
  [[ -f "$LINGO_RUN/pid" ]] || return 1
  LINGO_PID="$(cat "$LINGO_RUN/pid")"
  [[ "$LINGO_PID" =~ ^[0-9]+$ ]] || return 1
  kill -0 "$LINGO_PID" 2>/dev/null || return 1
  local lingo_command
  lingo_command="$(ps -p "$LINGO_PID" -o args=)"
  [[ "$lingo_command" == *"$LINGO_ROOT/node_modules/tsx/dist/cli.mjs"* && "$lingo_command" == *"$LINGO_ROOT/scripts/demo.ts"* ]]
}
urls() {
  echo "Lingosaic: http://127.0.0.1:5173/"
  echo "Inspector: http://127.0.0.1:5174/"
  local lingo_ip
  for lingo_ip in $(hostname -I); do
    [[ "$lingo_ip" == *:* ]] && continue
    echo "Lingosaic: http://$lingo_ip:5173/"
    echo "Inspector: http://$lingo_ip:5174/"
  done
  echo "Log: $LINGO_RUN/development.log"
}
case "${1:-}" in
  start)
    if managed_running; then echo "Lingosaic development is already running (PID $LINGO_PID)."; urls; exit 0; fi
    [[ -f node_modules/tsx/dist/cli.mjs ]] || { echo "Run npm install first."; exit 1; }
    rm -f "$LINGO_RUN/pid" "$LINGO_RUN/ready"
    LINGOSAIC_READY_FILE="$LINGO_RUN/ready" setsid node "$LINGO_ROOT/node_modules/tsx/dist/cli.mjs" "$LINGO_ROOT/scripts/demo.ts" </dev/null >"$LINGO_RUN/development.log" 2>&1 9>&- &
    LINGO_PID=$!
    printf '%s\n' "$LINGO_PID" >"$LINGO_RUN/pid"
    for ((lingo_attempt=0;lingo_attempt<150;lingo_attempt++)); do
      if ! managed_running; then echo "Startup failed:"; tail -n 20 "$LINGO_RUN/development.log"; rm -f "$LINGO_RUN/pid"; exit 1; fi
      if [[ -f "$LINGO_RUN/ready" ]] && curl -fsS --max-time 1 http://127.0.0.1:5173/ >/dev/null && curl -fsS --max-time 1 http://127.0.0.1:5174/ >/dev/null; then echo "Lingosaic development started (detached, PID $LINGO_PID)."; urls; exit 0; fi
      sleep 0.2
    done
    kill -TERM -- "-$LINGO_PID" 2>/dev/null || true
    rm -f "$LINGO_RUN/pid" "$LINGO_RUN/ready"
    echo "Startup timed out. See $LINGO_RUN/development.log"; exit 1
    ;;
  stop)
    if ! managed_running; then echo "Lingosaic development is stopped."; rm -f "$LINGO_RUN/pid" "$LINGO_RUN/ready"; exit 0; fi
    kill -TERM -- "-$LINGO_PID" 2>/dev/null || true
    for ((lingo_attempt=0;lingo_attempt<50;lingo_attempt++)); do
      managed_running || break
      sleep 0.1
    done
    if managed_running; then kill -KILL -- "-$LINGO_PID" 2>/dev/null || true; fi
    rm -f "$LINGO_RUN/pid" "$LINGO_RUN/ready"
    echo "Lingosaic development stopped."
    ;;
  state)
    if managed_running; then
      if [[ -f "$LINGO_RUN/ready" ]]; then echo "Lingosaic development is running (PID $LINGO_PID)."; else echo "Lingosaic development is starting (PID $LINGO_PID)."; fi
      urls
    else echo "Lingosaic development is stopped."; fi
    ;;
  *) echo "Usage: ./lingosaic.sh start|stop|state"; exit 2 ;;
esac
