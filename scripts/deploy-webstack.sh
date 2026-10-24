#!/usr/bin/env bash
# Azure's Linux Run Command invokes /bin/sh even when a script has a shebang.
[ -n "${BASH_VERSION:-}" ] || exec bash "$0" "$@"
set -euo pipefail
umask 077

sha="${1:?Pass the verified 40-character commit SHA}"
[[ "$sha" =~ ^[a-f0-9]{40}$ ]] || { echo "Invalid release SHA" >&2; exit 1; }
[[ "$(id -u)" == 0 ]] || { echo "Run through Azure VM Run Command as root" >&2; exit 1; }
for command in docker curl tar flock caddy systemctl; do
  command -v "$command" >/dev/null || { echo "Missing prerequisite: $command" >&2; exit 1; }
done
docker compose version >/dev/null
exec 9>/run/figure-deploy.lock
flock -n 9 || { echo "Another Figure deployment is running" >&2; exit 1; }

root=/opt/webstack/figure
release="$root/releases/$sha"
image="figure:$sha"
mkdir -p "$root/releases"
[[ -f "$root/.env" && ! -L "$root/.env" ]] || {
  echo "Provision $root/.env from deploy/production.env.example before deploying. No environment file was created or overwritten." >&2
  exit 1
}
chmod 600 "$root/.env"
chown 1000:1000 "$root/.env"
mkdir -p "$root/data/database-backups"
chown -R 1000:1000 "$root/data"

if [[ ! -d "$release" ]]; then
  archive="$(mktemp /tmp/figure-release-XXXXXX.tar.gz)"
  trap 'rm -f "$archive"' EXIT
  curl --fail --silent --show-error --location --retry 3 \
    "https://codeload.github.com/huangyingting/Figure/tar.gz/$sha" -o "$archive"
  mkdir "$release"
  tar -xzf "$archive" --strip-components=1 -C "$release"
fi
docker build --pull --tag "$image" "$release"
compose=(docker compose --project-name figure --file "$release/deploy/compose.yaml")
export FIGURE_IMAGE="$image"
"${compose[@]}" run --rm --no-deps web node --import tsx scripts/validate-production-env.ts

previous=""
if [[ -f "$root/release.env" ]]; then
  previous="$(sed -n 's/^FIGURE_IMAGE=//p' "$root/release.env")"
  [[ "$previous" =~ ^figure:[a-f0-9]{40}$ ]] || { echo "Invalid saved previous release" >&2; exit 1; }
fi

# Stop only Figure while backing up and applying forward-only migrations.
"${compose[@]}" stop web
restore_previous() {
  local status=$?
  if [[ -n "$previous" ]]; then
    export FIGURE_IMAGE="$previous"
    "${compose[@]}" up -d --no-build web || echo "Previous Figure image could not be restarted" >&2
  else
    "${compose[@]}" stop web || echo "Failed Figure release could not be stopped" >&2
  fi
  echo "Deployment failed. Database migrations were not rolled back; inspect the backup before any manual recovery." >&2
  exit "$status"
}
trap restore_previous ERR
if [[ -f "$root/data/figure.db" ]]; then
  # VACUUM INTO produces a consistent backup even if SQLite has a WAL file.
  backup="pre-$sha-$(date -u +%Y%m%dT%H%M%S%N).db"
  "${compose[@]}" run --rm --no-deps web node --input-type=module -e \
    "import { PrismaClient } from '@prisma/client'; const db = new PrismaClient({ datasourceUrl: 'file:/data/figure.db' }); try { await db.\$executeRawUnsafe(\"VACUUM INTO '/data/database-backups/$backup'\"); } finally { await db.\$disconnect(); }"
fi
"${compose[@]}" run --rm --no-deps web npm run db:deploy
"${compose[@]}" up -d --no-build --wait --wait-timeout 120 web

proxy=/etc/caddy/sites/figure.caddy
proxy_existed=false
[[ ! -e "$proxy" ]] || proxy_existed=true
[[ ! -e "$proxy" ]] || cmp --silent "$release/deploy/figure.caddy" "$proxy" || {
  echo "Existing Figure proxy differs; review it before replacing. No shared proxy configuration was overwritten." >&2
  false
}
install -m 644 "$release/deploy/figure.caddy" "$proxy"
if ! caddy validate --config /etc/caddy/Caddyfile; then
  # Remove only the just-installed Figure fragment, preserving all other sites.
  if [[ "$proxy_existed" == false ]]; then rm "$proxy"; fi
  false
fi
systemctl reload caddy
# The first Caddy reload starts asynchronous certificate issuance.
curl --fail --silent --show-error --retry 30 --retry-all-errors \
  --retry-delay 5 --retry-max-time 180 --max-time 15 \
  "https://figure.genisisiq.com/api/health"
printf 'FIGURE_IMAGE=%s\n' "$image" > "$root/release.env"
ln -sfn "$release" "$root/current"
trap - ERR
printf '\nFigure release %s is healthy at https://figure.genisisiq.com\n' "$sha"
