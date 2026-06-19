#!/bin/bash
set -e

HBA_FILE="/etc/postgresql/16/main/pg_hba.conf"

# Add fixit user md5 auth
if ! grep -q 'fixit_db' "$HBA_FILE"; then
  sed -i '/^# IPv4 local connections:/a host    fixit_db        fixit           127.0.0.1\/32            md5' "$HBA_FILE"
  echo "Règle ajoutée dans pg_hba.conf"
else
  echo "Règle déjà présente"
fi

# Reload PostgreSQL
pg_ctlcluster 16 main reload
echo "PostgreSQL rechargé"

# Test connection
sleep 1
PGPASSWORD='fixit_password' psql -h 127.0.0.1 -U fixit -d fixit_db -c 'SELECT 1 AS test;'
echo "Connexion OK !"
