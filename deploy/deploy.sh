#!/usr/bin/env bash
# Run on the VPS from /opt/ldap-utility (or wherever compose lives).
#
# CI (self-hosted runner): already logged into GHCR via GITHUB_TOKEN, then:
#   ./deploy.sh --skip-login
#
# Manual: provide GHCR_USERNAME + GHCR_TOKEN (PAT with read:packages):
#   GHCR_USERNAME=... GHCR_TOKEN=... ./deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

SKIP_LOGIN=0
if [[ "${1:-}" == "--skip-login" ]]; then
	SKIP_LOGIN=1
fi

if [[ "$SKIP_LOGIN" -eq 0 ]]; then
	if [[ -z "${GHCR_USERNAME:-}" || -z "${GHCR_TOKEN:-}" ]]; then
		echo "GHCR_USERNAME and GHCR_TOKEN are required (or pass --skip-login if already logged in)" >&2
		exit 1
	fi
	echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
fi

docker compose pull
docker compose up -d --remove-orphans
docker image prune -f
echo "Deploy complete."
