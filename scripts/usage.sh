#!/bin/bash
# Shows how many Gemini calls have been used today and in the last days.
# Run it with: npm run usage
cd "$(dirname "$0")/.."

LIMIT=$(grep '^GEMINI_DAILY_LIMIT=' .env 2>/dev/null | cut -d= -f2)
LIMIT=${LIMIT:-100}

# Runs a query inside the database container, using the login it already has
query() {
  docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"' -- "$@"
}

USED=$(query -tA -c "SELECT COALESCE((SELECT calls FROM gemini_usage WHERE day = (now() AT TIME ZONE 'Europe/Stockholm')::date), 0)") || {
  echo "Could not reach the database. Is it running? Try: docker compose up -d"
  exit 1
}

echo "Gemini calls today: $USED / $LIMIT ($((LIMIT - USED)) left)"
echo
echo "Last 7 days:"
query -c "SELECT day, calls FROM gemini_usage WHERE day > current_date - 7 ORDER BY day DESC"
