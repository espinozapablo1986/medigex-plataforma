#!/usr/bin/env bash
#
# Despliegue manual de MEDIGEX en el VPS.
# Hace lo mismo que el workflow de GitHub Actions, para cuando se necesita
# desplegar desde el propio servidor o sin pasar por GitHub.
#
#   ssh deploy@159.195.7.134
#   cd /opt/stacks/medigex && ./deploy/desplegar.sh [--sembrar]
#
set -euo pipefail

DIRECTORIO="/opt/stacks/medigex"
SEMBRAR=0

for argumento in "$@"; do
  case "$argumento" in
    --sembrar) SEMBRAR=1 ;;
    *) echo "Argumento no reconocido: $argumento"; exit 1 ;;
  esac
done

cd "$DIRECTORIO"

if [ ! -f .env ]; then
  echo "❌ Falta el archivo .env en $DIRECTORIO."
  echo "   Créalo a partir de .env.example con las claves de producción."
  exit 1
fi

echo "▸ Trayendo los últimos cambios…"
git fetch --all --prune
git reset --hard origin/main

# `migrator` está tras el perfil "tools": sin él, `build` lo omite y las
# migraciones correrían con una imagen desactualizada.
export VERSION="$(git rev-parse --short HEAD)"
echo "▸ Construyendo las imágenes ($VERSION)…"
docker compose --profile tools build

echo "▸ Aplicando migraciones…"
if [ "$SEMBRAR" -eq 1 ]; then
  docker compose --profile tools run --rm migrator
else
  SEED_DEMO=0 docker compose --profile tools run --rm migrator
fi

echo "▸ Levantando el stack…"
docker compose up -d --remove-orphans
# Forzar el recambio: si sólo cambió el contenido de la imagen, `up -d` puede
# dejar corriendo el contenedor anterior.
docker compose up -d --no-deps --force-recreate app

echo "▸ Esperando a que la aplicación responda…"
for intento in $(seq 1 20); do
  estado=$(docker inspect --format '{{.State.Health.Status}}' medigex-app 2>/dev/null || echo "sin-datos")
  if [ "$estado" = "healthy" ]; then
    echo "✅ MEDIGEX está corriendo — https://medic.asdf123.cl"
    docker image prune -f --filter "until=168h" >/dev/null
    exit 0
  fi
  echo "  intento $intento/20 — estado: $estado"
  sleep 6
done

echo "❌ La aplicación no quedó saludable. Últimos registros:"
docker compose logs --tail 60 app
exit 1
