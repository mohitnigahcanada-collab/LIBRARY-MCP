#!/bin/bash
# BuilderBrain Configuration Script
# Safely configures AI backends from GNOME Keyring
# Usage: ./configure-builderbrain.sh [--dry-run]

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

CONFIG_DIR="$HOME/Desktop/LIBRARY-MCP/builderbrain/brain-data"
CONFIG_FILE="$CONFIG_DIR/config.json"
BACKUP_FILE="${CONFIG_FILE}.backup-$(date +%Y%m%d-%H%M%S)"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=true
    echo -e "${YELLOW}🔍 DRY RUN MODE - No files will be modified${NC}"
fi

echo -e "${BLUE}🧠 BuilderBrain Configuration Tool${NC}"
echo "================================================"

# Ensure directory exists
mkdir -p "$CONFIG_DIR"

# Backup existing config if it exists
if [ -f "$CONFIG_FILE" ] && [ "$DRY_RUN" = false ]; then
    cp "$CONFIG_FILE" "$BACKUP_FILE"
    echo -e "${GREEN}📦 Backed up existing config to:${NC}"
    echo "   $BACKUP_FILE"
fi

# Retrieve API keys from GNOME Keyring
echo ""
echo -e "${BLUE}🔑 Retrieving API keys from GNOME Keyring...${NC}"

get_key() {
    local service="$1"
    local key
    key=$(secret-tool lookup service "$service" username default 2>/dev/null || echo "")
    if [ -n "$key" ]; then
        echo -e "${GREEN}   ✅ ${service}${NC}: ${key:0:10}..."
        echo "$key"
    else
        echo -e "${RED}   ❌ ${service}${NC}: Not found"
        echo ""
    fi
}

GROQ_KEY=$(get_key "groq")
GEMINI_KEY=$(get_key "gemini-api")
SILICON_KEY=$(get_key "siliconflow")
NVIDIA_KEY=$(get_key "nvidia")
POOLSIDE_KEY=$(get_key "poolside")

# Count enabled backends
ENABLED_COUNT=0
[ -n "$GROQ_KEY" ] && ((ENABLED_COUNT++))
[ -n "$GEMINI_KEY" ] && ((ENABLED_COUNT++))
[ -n "$SILICON_KEY" ] && ((ENABLED_COUNT++))
[ -n "$NVIDIA_KEY" ] && ((ENABLED_COUNT++))
[ -n "$POOLSIDE_KEY" ] && ((ENABLED_COUNT++))

echo ""
echo -e "${BLUE}📊 Summary:${NC} $ENABLED_COUNT AI backend(s) available"

# Build JSON config
CONFIG_JSON=$(cat <<EOF
{
  "ai_backends": [
    {
      "name": "groq-llama",
      "type": "openai-compatible",
      "endpoint": "https://api.groq.com/openai/v1",
      "apiKey": "${GROQ_KEY}",
      "model": "llama-3.3-70b-versatile",
      "priority": 1,
      "enabled": $([ -n "$GROQ_KEY" ] && echo "true" || echo "false")
    },
    {
      "name": "gemini-flash",
      "type": "openai-compatible",
      "endpoint": "https://generativelanguage.googleapis.com/v1beta/openai",
      "apiKey": "${GEMINI_KEY}",
      "model": "gemini-2.0-flash-exp",
      "priority": 2,
      "enabled": $([ -n "$GEMINI_KEY" ] && echo "true" || echo "false")
    },
    {
      "name": "siliconflow-deepseek",
      "type": "openai-compatible",
      "endpoint": "https://api.siliconflow.cn/v1",
      "apiKey": "${SILICON_KEY}",
      "model": "deepseek-ai/DeepSeek-V3",
      "priority": 3,
      "enabled": $([ -n "$SILICON_KEY" ] && echo "true" || echo "false")
    },
    {
      "name": "nvidia-llama",
      "type": "openai-compatible",
      "endpoint": "https://integrate.api.nvidia.com/v1",
      "apiKey": "${NVIDIA_KEY}",
      "model": "meta/llama-3.1-405b-instruct",
      "priority": 4,
      "enabled": $([ -n "$NVIDIA_KEY" ] && echo "true" || echo "false")
    },
    {
      "name": "poolside-code",
      "type": "openai-compatible",
      "endpoint": "https://api.poolside.ai/v1",
      "apiKey": "${POOLSIDE_KEY}",
      "model": "poolside-1",
      "priority": 5,
      "enabled": $([ -n "$POOLSIDE_KEY" ] && echo "true" || echo "false")
    }
  ],
  "fallback_strategy": "smart-fallback",
  "port": 8765,
  "alerts": {},
  "daily_trends": {
    "enabled": false,
    "search_apis": ["brave"],
    "schedule_time": "09:00",
    "filter_min_stars": 100,
    "max_repos_per_day": 5
  }
}
EOF
)

if [ "$DRY_RUN" = true ]; then
    echo ""
    echo -e "${YELLOW}📄 Preview of config.json (not saved):${NC}"
    echo "$CONFIG_JSON" | jq .
else
    echo "$CONFIG_JSON" | jq . > "$CONFIG_FILE"
    chmod 600 "$CONFIG_FILE"
    echo ""
    echo -e "${GREEN}✅ Configuration saved to:${NC}"
    echo "   $CONFIG_FILE"
    echo -e "${GREEN}🔒 Permissions set to 600 (read/write owner only)${NC}"
fi

echo ""
echo -e "${BLUE}🎯 Enabled AI Backends:${NC}"
echo "$CONFIG_JSON" | jq -r '.ai_backends[] | select(.enabled == true) | "   \(.priority). \(.name) (\(.model))"'

echo ""
echo -e "${GREEN}✅ BuilderBrain configuration complete!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "   1. Restart BuilderBrain: cd builderbrain && npm start"
echo "   2. Test: curl http://localhost:8765/status"
echo "   3. Try context: curl -X POST http://localhost:8765/context -H 'Content-Type: application/json' -d '{\"task\":\"test\"}'"
