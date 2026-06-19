#!/bin/bash
# Script de démarrage en développement local
# Usage: bash start-dev.sh

FIXIT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Fixit — Démarrage Développement ==="
echo "Répertoire: $FIXIT_DIR"

# Tuer les processus existants
pkill -f "node.*fixit.*server.js" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 1

# Démarrage du backend
echo "[1/2] Démarrage du backend (port 3001)..."
cd "$FIXIT_DIR/backend"
nohup node src/server.js > /tmp/fixit_backend.log 2>&1 &
echo "Backend PID=$!"

# Attendre que le backend soit prêt
sleep 3
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
  echo "      ✅ Backend OK: http://localhost:3001"
else
  echo "      ❌ Backend non démarré — voir /tmp/fixit_backend.log"
  cat /tmp/fixit_backend.log
  exit 1
fi

# Démarrage du frontend
echo "[2/2] Démarrage du frontend (port 5173)..."
cd "$FIXIT_DIR"
nohup npm run dev > /tmp/fixit_frontend.log 2>&1 &
echo "Frontend PID=$!"

sleep 5
echo ""
echo "=== Application Fixit démarrée ==="
echo "  Frontend : http://localhost:5173"
echo "  Backend  : http://localhost:3001"
echo "  Login    : admin@fixit.local / Admin1234!"
echo ""
echo "Logs: /tmp/fixit_backend.log | /tmp/fixit_frontend.log"
echo ""
tail -5 /tmp/fixit_frontend.log
