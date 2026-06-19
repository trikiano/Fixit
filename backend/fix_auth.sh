#!/bin/bash
set -e

HBA_FILE="/etc/postgresql/16/main/pg_hba.conf"

# Replace md5 with scram-sha-256 for fixit user
sed -i 's/host    fixit_db        fixit           127.0.0.1\/32            md5/host    fixit_db        fixit           127.0.0.1\/32            scram-sha-256/' "$HBA_FILE"

# Reset password using ALTER ROLE to ensure it's scram-sha-256 encoded
sudo -u postgres psql -c "ALTER ROLE fixit WITH PASSWORD 'fixit_password';"

# Reload
pg_ctlcluster 16 main reload
sleep 1

# Test
echo "=== Test connexion ==="
PGPASSWORD='fixit_password' psql -h 127.0.0.1 -U fixit -d fixit_db -c "SELECT 'Connexion OK !' as status;"
