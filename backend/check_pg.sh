#!/bin/bash
sudo -u postgres psql -d fixit_db -c "SELECT rolname, left(rolpassword, 20) as pass_preview FROM pg_authid WHERE rolname = 'fixit';"
echo "pg_hba rules:"
grep -v '^#' /etc/postgresql/16/main/pg_hba.conf | grep -v '^$'
echo "password_encryption setting:"
sudo -u postgres psql -c "SHOW password_encryption;"
