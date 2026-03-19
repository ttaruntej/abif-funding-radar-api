# ABIF Funding Radar API

Dedicated backend for the public GitHub Pages frontend at `abif-funding-radar`.

## What it does

- Dispatches `send-email.yml` through the GitHub Actions API
- Dispatches `source-sync.yml` through the GitHub Actions API
- Exposes workflow status for the frontend
- Serves live dispatch metadata from the repo without waiting for the next Pages build
- Sends ecosystem feedback emails through SMTP

## Environment variables

- `GH_TOKEN` or `GH_PAT`: GitHub token with access to dispatch workflows for the target repo
- `ACCESS_PASSWORD` or `ACCESS_PASSWORDS`: Access token(s) for `POST /api/verify-access` (`ACCESS_PASSWORDS` accepts comma-separated values)
- `SITE_PASSWORD`, `ADMIN_PASSWORD`: legacy aliases supported for auth compatibility
- `ACCESS_SESSION_SECRET`: secret used to sign short-lived API access tokens returned by `POST /api/verify-access`
- `ACCESS_TOKEN_TTL_SECONDS`: optional token lifetime in seconds (default: `28800`)
- `GH_REPO_OWNER`: defaults to `ttaruntej`
- `GH_REPO_NAME`: defaults to `abif-funding-radar`
- `GH_REF`: defaults to `main`
- `EMAIL_WORKFLOW_ID`: defaults to `send-email.yml`
- `SYNC_WORKFLOW_ID`: defaults to `source-sync.yml`
- `ALLOWED_ORIGINS`: comma-separated frontend origins allowed to call the API
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`: SMTP config for feedback relay
- `ABIF_TEAM_EMAIL`: optional feedback recipient fallback
- `FEEDBACK_TO`: optional override for feedback emails

## Routes

- `GET /api/health`
- `POST /api/verify-access` (returns a short-lived bearer token)
- `GET /api/trigger-email` (requires bearer token)
- `POST /api/trigger-email` (requires bearer token)
- `GET /api/trigger-sync` (requires bearer token)
- `POST /api/trigger-sync` (requires bearer token)
- `POST /api/send-feedback` (requires bearer token)

## Hosting

This repo is designed for serverless deployment on Vercel. After importing the repo, set the environment variables above and point the frontend `VITE_API_BASE_URL` to the deployed URL.

Deploy shortcut:

- [Import on Vercel](https://vercel.com/new/clone?repository-url=https://github.com/ttaruntej/abif-funding-radar-api)
