#!/bin/bash
set -e

# Drop and recreate user to ensure password is correct
sudo -u postgres psql <<'EOSQL'
DROP USER IF EXISTS fixit;
CREATE USER fixit WITH PASSWORD 'fixit_password' LOGIN;
DROP DATABASE IF EXISTS fixit_db;
CREATE DATABASE fixit_db OWNER fixit;
GRANT ALL PRIVILEGES ON DATABASE fixit_db TO fixit;
\c fixit_db
GRANT ALL ON SCHEMA public TO fixit;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO fixit;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO fixit;
EOSQL

echo "=== Utilisateur et base recréés ==="

# Test immediate connection via postgres user
sudo -u postgres psql -d fixit_db -c "SELECT current_user, current_database();"

echo "=== Test MD5 auth ==="
PGPASSWORD='fixit_password' psql -h 127.0.0.1 -U fixit -d fixit_db -c "SELECT 'OK' as status;" || echo "MD5 auth failed - check pg_hba"
