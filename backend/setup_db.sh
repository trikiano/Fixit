#!/bin/bash
set -e

echo "=== Configuration de la base de données ==="

sudo -u postgres psql <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'fixit') THEN
    CREATE USER fixit WITH PASSWORD 'fixit_password';
  END IF;
END $$;

SELECT 'Utilisateur fixit OK';
SQL

sudo -u postgres psql <<'SQL'
SELECT pg_catalog.pg_database.datname FROM pg_catalog.pg_database WHERE datname = 'fixit_db';
SQL

sudo -u postgres createdb -O fixit fixit_db 2>/dev/null || echo "Base fixit_db existe déjà"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE fixit_db TO fixit;" || true

echo "=== Base de données prête ==="
