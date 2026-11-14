#!/bin/zsh
# Money Tracker launcher.
# Starts the local dashboard server only when you open it, opens Chrome, and shuts the server down
# (freeing its memory/CPU) a few minutes after you close the dashboard tab. Nothing here talks to the internet; it serves 127.0.0.1 only.
#
# Env: NO_OPEN=1 skips opening a browser tab (the extension popup opens it itself).
#      LAUNCHER_TEST=1 runs a quick start/check/stop cycle without opening a browser or dialog.

PORT=${PORT:-3000}
ROOT="${0:A:h:h}"
URL="http://127.0.0.1:$PORT"
LOG="$ROOT/.data/server.log"
TITLE="Money Tracker"
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.volta/bin:$PATH"
for d in "$HOME"/.nvm/versions/node/*/bin(N); do PATH="$d:$PATH"; done

say_dialog() { /usr/bin/osascript -e "display dialog \"$1\" buttons {\"OK\"} default button \"OK\" with icon caution with title \"$TITLE\"" >/dev/null 2>&1; }
fail() { echo "$1" >&2; [[ -z $LAUNCHER_TEST ]] && say_dialog "$1"; exit 1; }

command -v node >/dev/null || fail "Node.js was not found. Install Node, then try again."
mkdir -p "$ROOT/.data"
cd "$ROOT" || fail "Could not open the project folder."

is_ours() { curl -fs --max-time 3 "$URL/api/orders" 2>/dev/null | grep -q '"orders"'; }
SERVER_PID=""
stop_server() {
  [[ -n $SERVER_PID ]] || return
  kill "$SERVER_PID" 2>/dev/null
  for i in {1..20}; do kill -0 "$SERVER_PID" 2>/dev/null || break; sleep 0.25; done
  kill -9 "$SERVER_PID" 2>/dev/null
  # `next start` spawns a child; make sure nothing is left on the port
  lsof -ti tcp:$PORT -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null
  SERVER_PID=""
}
trap stop_server EXIT INT TERM HUP

# Something already on the port?
if lsof -ti tcp:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  if is_ours; then
    [[ -z $LAUNCHER_TEST && -z $NO_OPEN ]] && open "$URL"
    echo "Money Tracker is already running; opened it."
    exit 0   # not started by us, so we don't stop it
  fi
  fail "Port $PORT is used by another program. Close it and try again."
fi

# Build if there is no build yet or the source changed since the last one (takes ~15 seconds).
if [[ ! -f .next/BUILD_ID ]] || [[ -n "$(find src package.json next.config.ts -newer .next/BUILD_ID -type f 2>/dev/null | head -1)" ]]; then
  echo "Building…"; npm run build >"$LOG" 2>&1 || fail "The app could not be built. See $LOG"
fi

echo "Starting server on $URL"
"$ROOT/node_modules/.bin/next" start -H 127.0.0.1 -p "$PORT" >"$LOG" 2>&1 &
SERVER_PID=$!

for i in {1..80}; do
  is_ours && break
  kill -0 "$SERVER_PID" 2>/dev/null || fail "The server stopped unexpectedly. See $LOG"
  sleep 0.5
done
is_ours || fail "The server did not start in time. See $LOG"

if [[ -n $LAUNCHER_TEST ]]; then
  echo "TEST: dashboard=$(curl -s -o /dev/null -w '%{http_code}' $URL/) connect=$(curl -s -o /dev/null -w '%{http_code}' $URL/connect) orders=$(curl -s $URL/api/orders | grep -o '"orders"' | head -1)"
  exit 0   # trap stops the server
fi

# Open in Chrome (the extension lives there), falling back to the default browser.
[[ -z $NO_OPEN ]] && { open -a "Google Chrome" "$URL" 2>/dev/null || open "$URL"; }

# No window to click: the dashboard page pings /api/ping while it is open; when the pings stop
# (all dashboard tabs closed) the server shuts itself down.
PING="$ROOT/.data/last-ping"
IDLE_LIMIT=${IDLE_LIMIT:-180}
started=$SECONDS
touch "$PING"
while kill -0 "$SERVER_PID" 2>/dev/null; do
  sleep 5
  last=$(stat -f %m "$PING" 2>/dev/null || echo 0)
  (( SECONDS - started > 60 && $(date +%s) - last > IDLE_LIMIT )) && break
done
echo "Dashboard closed; stopping."
exit 0
