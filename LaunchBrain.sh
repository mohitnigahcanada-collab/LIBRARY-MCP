#!/bin/bash
# BuilderBrain Launcher — Linux (Arch, Cachyos, Ubuntu)
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/builderbrain"

echo "BuilderBrain starting..."
echo "Installing dependencies..."
npm install --silent 2>/dev/null || true

if [ ! -d "dist" ]; then
  echo "Building..."
  npm run build:all 2>/dev/null || npm run build
fi

echo "Starting server on port 8765..."
npm start &
SERVER_PID=$!

sleep 2

echo ""
echo "BuilderBrain is running!"
echo "Dashboard: http://localhost:8765"
echo "API: http://localhost:8765/status"
echo ""
echo "Press Ctrl+C to stop."

# Try to open browser
xdg-open "http://localhost:8765" 2>/dev/null || \
  firefox "http://localhost:8765" 2>/dev/null || \
  chromium "http://localhost:8765" 2>/dev/null || \
  echo "Open http://localhost:8765 in your browser"

wait $SERVER_PID
