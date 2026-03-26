#!/bin/bash
# Deploy schema functions to Supabase
# Usage: ./scripts/deploy-schema.sh [local|prod]

set -e

ENV=${1:-local}

# Load environment
if [ "$ENV" = "prod" ]; then
    echo "📦 Deploying to PRODUCTION..."
    set -a
    source .env.prod
    set +a
else
    echo "🏠 Deploying to LOCAL..."
    set -a
    source .env
    set +a
fi

# Set PostgreSQL connection string
if [ "$ENV" = "local" ]; then
    DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
else
    # For production, extract from SUPABASE_URL or use direct connection
    DB_URL="${DATABASE_URL:-$SUPABASE_URL}"
fi

echo "🎯 Target: $SUPABASE_URL"
echo ""

# Function to execute SQL file
execute_sql() {
    local file=$1
    local filename=$(basename "$file")

    echo "   Applying $filename..."
    psql "$DB_URL" -f "$file" -v ON_ERROR_STOP=1 -q
}

# Create schemas
echo "1️⃣  Creating schemas..."
psql "$DB_URL" -c "CREATE SCHEMA IF NOT EXISTS private;" -q 2>&1 | grep -v "already exists" || true

# Deploy in order: private → public
echo ""
echo "2️⃣  Deploying private functions..."
for file in supabase/schema/private/*.sql; do
    [ -f "$file" ] && execute_sql "$file"
done

echo ""
echo "3️⃣  Deploying public functions..."
for file in supabase/schema/public/*.sql; do
    [ -f "$file" ] && execute_sql "$file"
done

# Set permissions
echo ""
echo "4️⃣  Setting permissions..."
psql "$DB_URL" -c "
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
    REVOKE ALL ON SCHEMA private FROM anon, authenticated;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM anon, authenticated;
" -q

echo ""
echo "✅ Schema deployed successfully!"
