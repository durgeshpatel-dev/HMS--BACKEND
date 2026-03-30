# Backend Deployment Context (Actual Current Flow)

Last updated: 30 March 2026

## 1) Production runtime
- Domain: `https://api.dppatel.in`
- Infra: Nginx on Ubuntu -> PM2 app `hms-backend` -> Node/Express (`dist/server.js`)

## 2) Canonical deploy script
- File: `DEPLOY_TO_PRODUCTION.sh` (this repo)

This script is the source of truth for backend live deployment.

## 3) Script behavior (safe deploy + rollback)
The script performs:
1. Auto-detect server app directory (`/home/ubuntu/HMS--BACKEND`, `/home/hms/HMS--BACKEND`, etc.)
2. Single-deploy lock using `/tmp/hms-backend.deploy.lock`
3. Backup metadata at `.deploy-backups/<timestamp>/` including previous commit + `.env` snapshot
4. `git fetch --prune origin`
5. Compare current commit vs `origin/main`
6. If changed:
	- `git reset --hard origin/main`
	- `npm ci` (fallback `npm install`)
	- `npm run build`
	- `npm run prisma:migrate:deploy --if-present`
	- `pm2 restart hms-backend --update-env` (or start if absent)
	- health checks with retries on `http://127.0.0.1:5000/health`
7. On any failure: automatic rollback to previous commit with reinstall, rebuild, restart, and health verification

### 3.1) Hardening notes (30 March 2026 incident fix)
- Rollback path now runs `npx prisma generate` before `npm run build`.
- Migration deploy now runs only when migration directories exist under `prisma/migrations/`.
- This avoids `P3005` baseline DB failures from blocking otherwise healthy code deploys.

## 4) Required npm scripts
- `build`: `tsc`
- `prisma:migrate:deploy`: `prisma migrate deploy`

## 5) How to run deploy from local workstation
Run directly with SSH + SCP:

1. Upload script
	- `scp -i ~/Downloads/hms-key.pem DEPLOY_TO_PRODUCTION.sh ubuntu@32.194.111.6:/tmp/DEPLOY_TO_PRODUCTION.sh`
2. Execute remotely
	- `ssh -i ~/Downloads/hms-key.pem ubuntu@32.194.111.6 "chmod +x /tmp/DEPLOY_TO_PRODUCTION.sh && /tmp/DEPLOY_TO_PRODUCTION.sh"`

## 6) Stability properties
- Prevents concurrent deploy overlap
- Avoids partial rollout state
- Rolls back automatically on failure
- Preserves current live behavior if deploy fails

## 7) Known failure mode to watch
Observed incident: SSH banner timeout (`Connection timed out during banner exchange`) and API timeouts at same time.

Meaning: infra/host/network issue, not code-level deploy step error. Recover host access first, then re-run deploy.

## 8) Post-deploy checks
1. `pm2 status` shows `hms-backend` online
2. `curl https://api.dppatel.in/health`
3. One auth API check (e.g., forgot-password)
4. `pm2 logs hms-backend --lines 50` has no crash loop

## 9) Related docs
- `../../deployment-files/CHANGE_AND_RELEASE_PROCESS.md`
- `../../deployment-files/TROUBLESHOOTING.md`
