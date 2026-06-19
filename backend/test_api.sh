#!/bin/bash
set -e

# Start backend in background
node /home/wlabiadh/projects/Fixit/backend/src/server.js &
BPID=$!
sleep 3

echo "=== Test Login ==="
RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@fixit.local","password":"Admin1234!"}')
echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Token OK:', d.get('token','NONE')[:40])"

TOKEN=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['token'])")

echo "=== Test /api/auth/me ==="
curl -s http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print('User:', d.get('name'), d.get('email'))"

echo "=== Test Clients (liste) ==="
curl -s "http://localhost:3001/api/entities/Client?sort=-created_date" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Clients: {len(d)} | 1er: {d[0][\"full_name\"]}')"

echo "=== Test Repairs ==="
curl -s "http://localhost:3001/api/entities/Repair" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Repairs: {len(d)} | statuts: {[r[\"status\"] for r in d[:3]]}')"

echo "=== Test Products ==="
curl -s "http://localhost:3001/api/entities/Product?sort=-created_date&limit=5" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Products: {len(d)} | 1er: {d[0][\"name\"] if d else None}')"

echo "=== Test Filter ==="
curl -s -X POST "http://localhost:3001/api/entities/Sale/filter" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"filters":{"status":"completee"},"sort":"-created_date","limit":10}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Ventes completees: {len(d)}')"

echo ""
echo "=== Tous les tests OK ==="
kill $BPID 2>/dev/null || true
