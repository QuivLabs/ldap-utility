# Deploy LDIF Builder (trust.quivlabs.com)

Containers are built on GitHub-hosted runners, pushed to **GHCR**, and pulled on the VPS by the QuivLabs **shared self-hosted Actions runner** on every push to `main`. Each deploy writes `/opt/ldap-utility/.env` from GitHub Actions secrets and syncs `docker-compose.yml` + `deploy.sh`.

| Surface | URL | Upstream |
| --- | --- | --- |
| LDIF Builder | `https://trust.quivlabs.com` | `127.0.0.1:3012` |

## Layout on the VPS

```
Internet → Nginx (TLS) → 127.0.0.1:3012 → ldap-utility container (:3000)
App root: /opt/ldap-utility
```

Ensure `/opt/ldap-utility` exists and is writable by `github-runner` (same pattern as `/opt/motoafrica`).

```bash
sudo mkdir -p /opt/ldap-utility
sudo chown github-runner:github-runner /opt/ldap-utility
```

## GitHub secrets

| Secret | Required | Default / notes |
| --- | --- | --- |
| `ORIGIN` | No | Defaults to `https://trust.quivlabs.com` in the workflow |

GHCR auth in CI uses `GITHUB_TOKEN` with `packages:write` (no custom PAT required for the workflow).

## First deploy

1. Push to `main` or run **Deploy** via `workflow_dispatch`.
2. Confirm the container:

```bash
cd /opt/ldap-utility && docker compose ps
curl -sI http://127.0.0.1:3012 | head -3   # expect 200
```

## Nginx + TLS (one-time, outside CI)

```bash
sudo cp /path/to/repo/deploy/nginx/trust.quivlabs.com.conf /etc/nginx/sites-available/trust.quivlabs.com.conf
sudo ln -sf /etc/nginx/sites-available/trust.quivlabs.com.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d trust.quivlabs.com
```

After Certbot adds TLS blocks, do **not** overwrite the live site file with the git HTTP-only template.

## Manual redeploy

```bash
cd /opt/ldap-utility
GHCR_USERNAME=... GHCR_TOKEN=... ./deploy.sh
# or, if already logged in to GHCR:
./deploy.sh --skip-login
```

## Runner

Uses the org shared runner `quivlabs-vps-shared` (`runs-on: self-hosted`). See [quivlabs-ops SHARED_RUNNER.md](https://github.com/QuivLabs/quivlabs-ops/blob/main/docs/SHARED_RUNNER.md).
