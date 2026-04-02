#!/usr/bin/env bash

# HMS Backend Production Deployment Script (Safe + Rollback)
# Usage on server:
#   chmod +x DEPLOY_TO_PRODUCTION.sh
#   ./DEPLOY_TO_PRODUCTION.sh
#
# Optional env overrides:
#   APP_DIR=/home/ubuntu/HMS--BACKEND
#   BRANCH=main
#   PM2_APP=hms-backend
#   HEALTH_URL=http://127.0.0.1:5000/health

set -Eeuo pipefail

echo "╔════════════════════════════════════════════════════════════╗"
echo "║      🚀 HMS Backend - Safe Production Deployment          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

detect_app_dir() {
    local candidates=(
        "${APP_DIR:-}"
        "/home/ubuntu/HMS--BACKEND"
        "/home/hms/HMS--BACKEND"
        "$HOME/HMS--BACKEND"
    )

    for dir in "${candidates[@]}"; do
        if [[ -n "${dir}" ]] && [[ -d "${dir}" ]] && [[ -f "${dir}/package.json" ]]; then
            echo "${dir}"
            return 0
        fi
    done

    return 1
}

APP_DIR="$(detect_app_dir || true)"
if [[ -z "${APP_DIR}" ]]; then
    echo "❌ Could not locate backend directory."
    echo "   Set APP_DIR and retry, e.g. APP_DIR=/home/ubuntu/HMS--BACKEND ./DEPLOY_TO_PRODUCTION.sh"
    exit 1
fi

BRANCH="${BRANCH:-main}"
PM2_APP="${PM2_APP:-hms-backend}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:5000/health}"
BACKUP_ROOT="${APP_DIR}/.deploy-backups"
TS="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="${BACKUP_ROOT}/${TS}"
LOCK_FILE="/tmp/${PM2_APP}.deploy.lock"

for cmd in git npm pm2 curl; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "❌ Missing required command: $cmd"
        exit 1
    fi
done

exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
    echo "⚠️ Another deployment is already running. Exiting."
    exit 1
fi

cd "${APP_DIR}"

PREV_COMMIT="$(git rev-parse --short HEAD)"
ROLLBACK_DONE="0"

rollback() {
    if [[ "${ROLLBACK_DONE}" == "1" ]]; then
        return 0
    fi
    ROLLBACK_DONE="1"
    trap - ERR INT TERM HUP

    echo ""
    echo "🛑 Deployment failed. Starting rollback to ${PREV_COMMIT}..."

    git reset --hard "${PREV_COMMIT}"

    if [[ -f package-lock.json ]]; then
        npm ci
    else
        npm install
    fi

    echo "🧬 Regenerating Prisma client for rollback build"
    npx prisma generate

    npm run build

    if pm2 describe "${PM2_APP}" >/dev/null 2>&1; then
        pm2 restart "${PM2_APP}" --update-env
    else
        pm2 start ecosystem.config.js --only "${PM2_APP}" --update-env
    fi

    sleep 3

    if curl -fsS --max-time 8 "${HEALTH_URL}" >/dev/null 2>&1; then
        echo "✅ Rollback successful. Service is healthy on previous commit ${PREV_COMMIT}."
    else
        echo "❌ Rollback could not verify health. Manual intervention required."
    fi
}

handle_interrupt() {
    echo ""
    echo "⚠️ Deployment interrupted (signal received)."
    rollback
    exit 1
}

trap rollback ERR
trap handle_interrupt INT TERM HUP

echo "📂 App directory: ${APP_DIR}"
echo "🌿 Branch: ${BRANCH}"
echo "🧩 PM2 app: ${PM2_APP}"
echo "🏥 Health URL: ${HEALTH_URL}"
echo "📦 Backup: ${BACKUP_DIR}"
echo ""

echo "📦 Step 1/8: Backup current deploy metadata"
mkdir -p "${BACKUP_DIR}"
cp -f .env "${BACKUP_DIR}/.env.backup" 2>/dev/null || true
git rev-parse HEAD > "${BACKUP_DIR}/commit.before"

echo "📥 Step 2/8: Fetch latest code"
git fetch --prune origin
TARGET_COMMIT="$(git rev-parse --short "origin/${BRANCH}")"
echo "   Current: ${PREV_COMMIT}"
echo "   Target : ${TARGET_COMMIT}"

if [[ "${PREV_COMMIT}" == "${TARGET_COMMIT}" ]]; then
    echo "ℹ️ Already on latest commit. Running health check only."
    curl -fsS --max-time 8 "${HEALTH_URL}" >/dev/null
    echo "✅ Service healthy. No deployment needed."
    exit 0
fi

echo "🔁 Step 3/8: Checkout target commit"
git reset --hard "origin/${BRANCH}"

echo "📦 Step 4/9: Install dependencies"
if [[ -f package-lock.json ]]; then
    npm ci
else
    npm install
fi

echo "🧬 Step 5/9: Generate Prisma client"
npx prisma generate

echo "🔨 Step 6/9: Build application"
npm run build

echo "🗄️  Step 7/9: Run DB migration (if present)"
if [[ -d prisma/migrations ]] && [[ -n "$(find prisma/migrations -mindepth 1 -maxdepth 1 -type d 2>/dev/null)" ]]; then
    npm run prisma:migrate:deploy --if-present
else
    echo "ℹ️ No Prisma migrations directory entries found; skipping migrate deploy."
fi

echo "🔄 Step 8/9: Restart backend"
if pm2 describe "${PM2_APP}" >/dev/null 2>&1; then
    pm2 restart "${PM2_APP}" --update-env
else
    pm2 start ecosystem.config.js --only "${PM2_APP}" --update-env
fi

echo "🏥 Step 9/9: Health check"
for i in {1..12}; do
    if curl -fsS --max-time 8 "${HEALTH_URL}" >/dev/null 2>&1; then
        break
    fi
    sleep 2
done

curl -fsS --max-time 8 "${HEALTH_URL}" >/dev/null

trap - ERR INT TERM HUP

# Audit log
DEPLOY_LOG="${APP_DIR}/.deploy-history.log"
echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] ${PREV_COMMIT} -> ${TARGET_COMMIT} | status=SUCCESS" >> "${DEPLOY_LOG}"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                 ✅ Deployment Successful                  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📋 Summary"
echo "   • Previous commit: ${PREV_COMMIT}"
echo "   • Current commit : ${TARGET_COMMIT}"
echo "   • PM2 app        : ${PM2_APP}"
echo "   • Health check   : PASSED"
echo "   • Audit log      : ${DEPLOY_LOG}"
