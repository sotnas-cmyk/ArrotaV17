#!/bin/bash
cd "$(dirname "$0")"
PORT=8000
if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server "$PORT" >/tmp/porta10a-server.log 2>&1 &
  SERVER_PID=$!
  trap 'kill $SERVER_PID 2>/dev/null' EXIT INT TERM
  sleep 0.7
  open "http://localhost:$PORT/"
  wait "$SERVER_PID"
else
  echo "Python 3 não está instalado."
  echo "Instala Python 3 ou usa: python3 -m http.server 8000"
  read -n 1
fi
