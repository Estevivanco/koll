#!/bin/bash
# Creates a login that can ONLY read the transactions table, for the analyst agent.
# Postgres runs this once, the first time the data volume is created.
# It is safe to run again by hand (it updates the role instead of failing).
set -e

psql -v ON_ERROR_STOP=1 -v pw="$ANALYST_DB_PASSWORD" -v db="$POSTGRES_DB" -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
SELECT 'CREATE ROLE analyst_ro LOGIN'
  WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'analyst_ro') \gexec

-- Not a superuser, can't create anything, only 5 connections, and read-only even by default
ALTER ROLE analyst_ro WITH NOSUPERUSER NOCREATEDB NOCREATEROLE CONNECTION LIMIT 5 PASSWORD :'pw';
ALTER ROLE analyst_ro SET default_transaction_read_only = on;

GRANT CONNECT ON DATABASE :"db" TO analyst_ro;
GRANT USAGE ON SCHEMA public TO analyst_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analyst_ro;
-- The importer creates the table later, so cover tables made in the future too
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO analyst_ro;
SQL
