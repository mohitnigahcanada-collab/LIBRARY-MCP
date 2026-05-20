#!/bin/bash
# Universal API Key Retrieval Script
# Safely retrieves API keys from GNOME Keyring
# Usage: ./get-api-key.sh <service> [username]
#        ./get-api-key.sh --list

set -euo pipefail

SERVICE="${1:-}"
USERNAME="${2:-default}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

show_usage() {
    echo "Usage:"
    echo "  $0 <service> [username]    Retrieve API key for service"
    echo "  $0 --list                  List all available services"
    echo ""
    echo "Examples:"
    echo "  $0 groq                    # Get Groq API key"
    echo "  $0 gemini-api              # Get Gemini API key"
    echo "  export KEY=\$($0 groq)      # Use in scripts"
    echo ""
    echo "Available services:"
    echo "  groq, gemini-api, siliconflow, nvidia, poolside, gemini (OAuth)"
}

list_services() {
    echo -e "${BLUE}🔑 Available API Keys in GNOME Keyring:${NC}"
    echo ""
    for service in groq gemini-api siliconflow nvidia poolside gemini; do
        key=$(secret-tool lookup service "$service" username "$USERNAME" 2>/dev/null || echo "")
        if [ -n "$key" ]; then
            echo -e "${GREEN}✅ $service${NC}: ${key:0:12}..."
        else
            echo -e "${RED}❌ $service${NC}: Not found"
        fi
    done
}

if [ -z "$SERVICE" ] || [ "$SERVICE" = "--help" ] || [ "$SERVICE" = "-h" ]; then
    show_usage
    exit 0
fi

if [ "$SERVICE" = "--list" ] || [ "$SERVICE" = "-l" ]; then
    list_services
    exit 0
fi

# Retrieve the key
KEY=$(secret-tool lookup service "$SERVICE" username "$USERNAME" 2>/dev/null || echo "")

if [ -z "$KEY" ]; then
    echo -e "${RED}ERROR: No key found for service '$SERVICE' with username '$USERNAME'${NC}" >&2
    echo "" >&2
    echo "Available services:" >&2
    list_services >&2
    exit 1
fi

# Output only the key (for piping)
echo "$KEY"
