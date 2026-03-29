# Deployment Context (Current)

Last updated: 29 March 2026

This document summarizes deployment and operations context for HMS.

## Live Components
- Backend API (`HMS--BACKEND`)
- Dashboard (`HMS-deshboard`)
- Mobile app + mobile web (`HMS-app`)

## Deployment Platforms
- Backend: production API hosting environment
- Dashboard: Vercel
- Mobile web: Firebase Hosting
- Android APK builds: GitHub Actions + Expo EAS

## Observed Live Backend Topology
- API domain: `api.dppatel.in`
- DNS target observed: `32.194.111.6`
- Health headers show: `nginx/1.18.0 (Ubuntu)` and Express response
- Working model: Nginx reverse proxy on Ubuntu -> backend Node process

## Critical Deployment Files
- `HMS--BACKEND/src/config/env.ts`
- `HMS-deshboard/vercel.json`
- `HMS-app/app.config.js`
- `HMS-app/eas.json`
- `HMS-app/.github/workflows/build-android-apk.yml`

## CI/CD Notes
APK workflow uses:
1. clean npm install
2. EAS JSON build output
3. `jq` extraction for `build_id` and `artifact_url`
4. shell writes to `$GITHUB_OUTPUT`

## Required Secrets
- `EXPO_TOKEN`
- `EAS_PROJECT_ID`
- Firebase service secrets (for web deploy workflow)

## Applying Changes To Live

### Backend (`HMS--BACKEND`)
1. Commit and push backend code.
2. SSH to production server.
3. Pull latest backend code.
4. Run `npm install` and `npm run build`.
5. Restart process (`pm2 restart hms-backend` or equivalent).
6. Verify `https://api.dppatel.in/health` and one business flow endpoint.

### HMS-app (`HMS-app`)
- APK rollout via `HMS-app/.github/workflows/build-android-apk.yml`.
- Mobile web rollout via Firebase hosting deployment workflow/process.

## Operational References
- Root deployment index: `../../deployment-files/README.md`
- Agent handoff: `../../deployment-files/AGENT_HANDOFF_CONTEXT.md`
- Troubleshooting: `../../deployment-files/TROUBLESHOOTING.md`
- Change/release checklist: `../../deployment-files/CHANGE_AND_RELEASE_PROCESS.md`
