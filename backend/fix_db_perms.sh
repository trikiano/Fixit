#!/bin/bash
set -e
sudo -u postgres psql -c "ALTER USER fixit WITH PASSWORD 'fixit_password';"
sudo -u postgres psql -d fixit_db -c "GRANT ALL ON SCHEMA public TO fixit;"
sudo -u postgres psql -d fixit_db -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO fixit;"
# Allow local connections without password for fixit user (for dev)
echo "Permissions OK"
