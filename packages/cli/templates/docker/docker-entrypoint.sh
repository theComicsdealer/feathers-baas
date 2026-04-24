#!/bin/sh
set -e

echo "► Running migrations..."
node dist/migrate.js

if [ "$SEED_ON_START" = "true" ]; then
  echo "► Seeding database..."
  node dist/seed.js
fi

echo "► Starting server..."
exec node dist/index.js
