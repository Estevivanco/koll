#!/bin/bash
# Creates the daily Gemini call counter and a login that can ONLY use that one table.
# All agents share it, so a loop or a heavy eval can't burn through your Vertex AI budget.
# Postgres runs this once, when the data volume is first created.
# Safe to run again by hand (it updates instead of failing).
set -e

psql -v ON_ERROR_STOP=1 -v pw="$BUDGET_DB_PASSWORD" -v db="$POSTGRES_DB" -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
CREATE TABLE IF NOT EXISTS gemini_usage (
  day   date PRIMARY KEY,
  calls integer NOT NULL
);

SELECT 'CREATE ROLE budget_rw LOGIN'
  WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'budget_rw') \gexec

ALTER ROLE budget_rw WITH NOSUPERUSER NOCREATEDB NOCREATEROLE CONNECTION LIMIT 10 PASSWORD :'pw';

GRANT CONNECT ON DATABASE :"db" TO budget_rw;
GRANT USAGE ON SCHEMA public TO budget_rw;
-- Only this table, and no DELETE: the counter can go up, never be wiped by an agent
GRANT SELECT, INSERT, UPDATE ON gemini_usage TO budget_rw;
SQL
