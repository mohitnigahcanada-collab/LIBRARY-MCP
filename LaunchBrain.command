#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/builderbrain"
echo "BuilderBrain starting..."
npm install --silent 2>/dev/null || true
[ ! -d "dist" ] && npm run build:all 2>/dev/null || true
npm start &
sleep 2
open "http://localhost:8765" 2>/dev/null || true
echo "Open http://localhost:8765"
wait
