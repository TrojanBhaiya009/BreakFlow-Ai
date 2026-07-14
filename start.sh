#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#   BreakFlow AI — Linux/macOS Startup Script
#   Installs dependencies and launches both backend & frontend
# ═══════════════════════════════════════════════════════════════

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Get the directory where this script lives
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

# Track background PIDs for cleanup
BACKEND_PID=""
FRONTEND_PID=""

# ── Cleanup on exit ──────────────────────────────────────────
cleanup() {
    echo ""
    echo -e "${YELLOW}⏹  Shutting down servers...${NC}"
    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill "$BACKEND_PID" 2>/dev/null
        wait "$BACKEND_PID" 2>/dev/null
        echo -e "${GREEN}   ✓ Backend stopped${NC}"
    fi
    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        kill "$FRONTEND_PID" 2>/dev/null
        wait "$FRONTEND_PID" 2>/dev/null
        echo -e "${GREEN}   ✓ Frontend stopped${NC}"
    fi
    echo -e "${GREEN}✅ All servers stopped. Goodbye!${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# ── Banner ───────────────────────────────────────────────────
echo -e "${CYAN}${BOLD}"
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║           BreakFlow AI — Launcher            ║"
echo "  ║     Stress-test against real human chaos     ║"
echo "  ╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Check for Node.js ────────────────────────────────────────
echo -e "${BOLD}[1/5] Checking prerequisites...${NC}"
if ! command -v node &>/dev/null; then
    echo -e "${RED}✗ Node.js is not installed!${NC}"
    echo "  Please install Node.js (v18+) from https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}   ✓ Node.js ${NODE_VERSION} found${NC}"

if ! command -v npm &>/dev/null; then
    echo -e "${RED}✗ npm is not installed!${NC}"
    echo "  npm usually comes with Node.js. Please reinstall Node.js."
    exit 1
fi

NPM_VERSION=$(npm -v)
echo -e "${GREEN}   ✓ npm v${NPM_VERSION} found${NC}"

# ── Install Backend Dependencies ─────────────────────────────
echo ""
echo -e "${BOLD}[2/5] Installing backend dependencies...${NC}"
if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}✗ Backend directory not found at: $BACKEND_DIR${NC}"
    exit 1
fi

cd "$BACKEND_DIR"
npm install
echo -e "${GREEN}   ✓ Backend dependencies installed${NC}"

# ── Install Playwright Browsers ──────────────────────────────
echo ""
echo -e "${BOLD}[3/5] Installing Playwright browsers...${NC}"
npx playwright install --with-deps chromium 2>/dev/null || npx playwright install chromium 2>/dev/null || {
    echo -e "${YELLOW}   ⚠ Playwright browser install had issues. You may need to run:${NC}"
    echo -e "${YELLOW}     cd backend && npx playwright install --with-deps${NC}"
}
echo -e "${GREEN}   ✓ Playwright browsers ready${NC}"

# ── Install Frontend Dependencies ────────────────────────────
echo ""
echo -e "${BOLD}[4/5] Installing frontend dependencies...${NC}"
if [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${RED}✗ Frontend directory not found at: $FRONTEND_DIR${NC}"
    exit 1
fi

cd "$FRONTEND_DIR"
npm install
echo -e "${GREEN}   ✓ Frontend dependencies installed${NC}"

# ── Start Servers ────────────────────────────────────────────
echo ""
echo -e "${BOLD}[5/5] Starting servers...${NC}"
echo ""

# Start backend
cd "$BACKEND_DIR"
npm run dev &
BACKEND_PID=$!
echo -e "${GREEN}   ✓ Backend starting on http://localhost:3001${NC}"

# Give backend a moment to start
sleep 2

# Start frontend
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!
echo -e "${GREEN}   ✓ Frontend starting on http://localhost:3000${NC}"

# ── Ready ────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}${BOLD}  ═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  🚀 BreakFlow AI is running!${NC}"
echo -e "${CYAN}${BOLD}  ═══════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}Frontend:${NC}  http://localhost:3000"
echo -e "  ${BOLD}Backend:${NC}   http://localhost:3001"
echo -e "  ${BOLD}Health:${NC}    http://localhost:3001/api/health"
echo ""
echo -e "${YELLOW}  Press Ctrl+C to stop all servers${NC}"
echo ""

# Wait for both processes
wait
