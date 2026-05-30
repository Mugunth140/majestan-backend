#!/bin/bash
set -e

echo "Starting database seed process..."

# Wait for MySQL to be ready
echo "Waiting for MySQL container to be ready..."
while ! docker compose -f ../compose.dev.yml exec -T mysql mysqladmin ping -h"localhost" --silent; do
    sleep 1
done

echo "Dropping and recreating database majestan..."
docker compose -f ../compose.dev.yml exec -T mysql mysql -uroot -p8220 -e "DROP DATABASE IF EXISTS majestan; CREATE DATABASE majestan;"

echo "Importing docs/dump.sql..."
docker compose -f ../compose.dev.yml exec -T mysql mysql -uroot -p8220 majestan < ../docs/dump.sql

echo "Fixing collation for wishlist, propertydetails, and enquiry to avoid migration errors..."
docker compose -f ../compose.dev.yml exec -T mysql mysql -uroot -p8220 majestan -e "ALTER TABLE wishlist CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; ALTER TABLE propertydetails CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; ALTER TABLE enquiry CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "Running TypeORM migrations to unify schema..."
DB_PORT=3307 bun run migration:run

echo "Seed completed successfully! 🚀"
