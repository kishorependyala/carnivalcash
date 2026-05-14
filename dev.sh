#!/bin/bash
# CarnivalCash local dev launcher
# Starts backend (port 5000) and frontend (port 3000)

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🛑 Stopping any existing servers..."
pkill -f "python.*run.py" 2>/dev/null
pkill -f "react-scripts start" 2>/dev/null
sleep 1

echo "🐍 Starting backend on http://localhost:5001 ..."
cd "$ROOT/backend"
# Load .env if present
if [ -f "$ROOT/backend/.env" ]; then
  export $(grep -v '^#' "$ROOT/backend/.env" | xargs)
fi
DATA_DIR="$ROOT/data" venv/bin/python run.py > /tmp/carnivalcash-backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

echo "⚛️  Starting frontend on http://localhost:3000 ..."
cd "$ROOT/frontend"
REACT_APP_API_BASE_URL=http://localhost:5001 npm start > /tmp/carnivalcash-frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

echo ""
echo "✅ Both servers started. Logs:"
echo "   Backend:  tail -f /tmp/carnivalcash-backend.log  →  http://localhost:5001/apidocs/"
echo "   Frontend: tail -f /tmp/carnivalcash-frontend.log"
echo ""
echo "Press Ctrl+C to stop both servers."

trap "echo ''; echo '🛑 Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT
wait
