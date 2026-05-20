#!/bin/bash
# BuilderBrain Launcher — Linux (Arch, Cachyos, Ubuntu, Debian)
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/builderbrain"

echo "🧠 BuilderBrain starting..."

if ! command -v node &>/dev/null; then
  echo "❌ Node.js not found. Install it: https://nodejs.org"
  exit 1
fi

echo "📦 Installing dependencies..."
npm install --silent 2>/dev/null

if [ ! -d "dist/dashboard" ]; then
  echo "🔨 Building (first run — takes ~30s)..."
  npm run build:all 2>/dev/null || npm run build
fi

echo "🚀 Starting server on port 8765..."
npm start &
SERVER_PID=$!
sleep 2

echo ""
echo "✅ BuilderBrain is running!"
echo "📚 Dashboard : http://localhost:8765"
echo "🔌 API       : http://localhost:8765/status"
echo "🧠 Version   : 2.0.0"
echo ""
echo "Press Ctrl+C to stop."
echo ""

xdg-open "http://localhost:8765" 2>/dev/null || \
  firefox "http://localhost:8765" 2>/dev/null || \
  chromium "http://localhost:8765" 2>/dev/null || \
  chromium-browser "http://localhost:8765" 2>/dev/null || \
  echo "👉 Open http://localhost:8765 in your browser"

wait $SERVER_PID
