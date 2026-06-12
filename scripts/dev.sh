#!/bin/bash
# PhantomRelay - Inicio del servidor

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

echo "[1/5] Instalando dependencias..."
if command -v bun >/dev/null 2>&1; then
  bun install --frozen-lockfile 2>/dev/null || bun install
else
  npm install 2>/dev/null || true
fi

echo "[2/5] Base de datos (JSON, sin migracion necesaria)"

STANDALONE_SERVER="$PROJECT_DIR/.next/standalone/server.js"

if [ ! -f "$STANDALONE_SERVER" ]; then
  echo "[3/5] Compilando servidor standalone..."
  NODE_OPTIONS="--max-old-space-size=384" npx next build
  cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
  cp -r public .next/standalone/ 2>/dev/null || true
  mkdir -p .next/standalone/data
  cp -r data/* .next/standalone/data/ 2>/dev/null || true
  cp .env .next/standalone/.env 2>/dev/null || true
else
  echo "[3/5] Build ya existe, omitiendo."
  [ ! -d ".next/standalone/.next/static" ] && cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
  [ ! -d ".next/standalone/public" ] && cp -r public .next/standalone/ 2>/dev/null || true
  if [ ! -d ".next/standalone/data" ] || [ ! -f ".next/standalone/data/store.json" ]; then
    mkdir -p .next/standalone/data
    cp -r data/* .next/standalone/data/ 2>/dev/null || true
  fi
  cp .env .next/standalone/.env 2>/dev/null || true
fi

echo "[4/5] Mini-servicios..."
MINI_SERVICES_DIR="$PROJECT_DIR/mini-services"
if [ -d "$MINI_SERVICES_DIR" ]; then
  for service_dir in "$MINI_SERVICES_DIR"/*; do
    if [ -d "$service_dir" ] && [ -f "$service_dir/package.json" ]; then
      service_name=$(basename "$service_dir")
      (cd "$service_dir" && bun install 2>/dev/null || true && exec bun run dev) >"/tmp/mini-service-${service_name}.log" 2>&1 &
      disown $! 2>/dev/null || true
    fi
  done
fi

echo "[5/5] Iniciando servidor..."
export NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000

if [ -f "$PROJECT_DIR/.env" ]; then
  set -a && source "$PROJECT_DIR/.env" && set +a
fi

exec node --max-old-space-size=512 "$STANDALONE_SERVER"
