#!/bin/bash
# Run this script as root (or with sudo) from the project root directory
# to set up CI/CD configuration files.
#
# Usage: sudo bash server/setup-ci.sh

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Setting up CI/CD files in $PROJECT_ROOT..."

# 1. Create GitHub Actions workflow
mkdir -p "$PROJECT_ROOT/.github/workflows"

cat > "$PROJECT_ROOT/.github/workflows/ci.yml" << 'CIEOF'
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  server:
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:8
        env:
          MYSQL_ROOT_PASSWORD: test
          MYSQL_DATABASE: test_db
        ports:
          - 3306:3306
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3
    env:
      DB_HOST: 127.0.0.1
      DB_USER: root
      DB_PASSWORD: test
      DB_NAME: test_db
      JWT_SECRET: ci-test-secret-that-is-at-least-32-chars
      ENCRYPTION_KEY: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
      TELNYX_API: KEYtest
      TELNYX_CONNECTION_ID: test-id
      APP_HOST: localhost
      APP_PORT: "3000"
      CORS_ORIGINS: "*"
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: server/package-lock.json
      - run: cd server && npm ci
      - run: cd server && npm test

  client:
    runs-on: ubuntu-latest
    env:
      REACT_APP_API_HOST: localhost
      REACT_APP_API_PORT: "3000"
      NEXT_PUBLIC_API_HOST: localhost
      NEXT_PUBLIC_API_PORT: "3000"
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: client/package-lock.json
      - run: cd client && npm ci
      - run: cd client && npm test
CIEOF

# 2. Create Dependabot config
cat > "$PROJECT_ROOT/.github/dependabot.yml" << 'DEPEOF'
version: 2
updates:
  - package-ecosystem: npm
    directory: /server
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
  - package-ecosystem: npm
    directory: /client
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
DEPEOF

# 3. Create .env.example (project-level)
cat > "$PROJECT_ROOT/.env.example" << 'ENVEOF'
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=agent_desktop

# Telnyx
TELNYX_API=KEYyour_telnyx_api_key
TELNYX_CONNECTION_ID=your_connection_id

# App
APP_HOST=your_domain.com
APP_PORT=3000

# Security
JWT_SECRET=generate_a_random_32_char_string
ENCRYPTION_KEY=generate_a_random_64_hex_char_string
SESSION_SECRET=generate_a_random_32_char_string
CORS_ORIGINS=https://your-frontend-domain.com

# Client (for React/Next.js)
REACT_APP_API_HOST=your_domain.com
REACT_APP_API_PORT=3000
NEXT_PUBLIC_API_HOST=your_domain.com
NEXT_PUBLIC_API_PORT=3000
ENVEOF

# Fix permissions so all users can read
chmod 644 "$PROJECT_ROOT/.github/workflows/ci.yml"
chmod 644 "$PROJECT_ROOT/.github/dependabot.yml"
chmod 644 "$PROJECT_ROOT/.env.example"
chmod 755 "$PROJECT_ROOT/.github/workflows"
chmod 755 "$PROJECT_ROOT/.github"

echo "Done! Created:"
echo "  $PROJECT_ROOT/.github/workflows/ci.yml"
echo "  $PROJECT_ROOT/.github/dependabot.yml"
echo "  $PROJECT_ROOT/.env.example"
echo ""
echo "You can now remove this script: rm $PROJECT_ROOT/server/setup-ci.sh"
