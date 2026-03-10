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
- `GH_REPO_OWNER`: defaults to `ttaruntej`
- `GH_REPO_NAME`: defaults to `abif-funding-radar`
- `GH_REF`: defaults to `main`
- `EMAIL_WORKFLOW_ID`: defaults to `send-email.yml`
- `SYNC_WORKFLOW_ID`: defaults to `source-sync.yml`
- `ALLOWED_ORIGINS`: comma-separated frontend origins allowed to call the API
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`: SMTP config for feedback relay
- `ABIF_TEAM_EMAIL`: default email recipient fallback
- `FEEDBACK_TO`: optional override for feedback emails

## Routes

- `GET /api/health`
- `GET /api/trigger-email`
- `POST /api/trigger-email`
- `GET /api/trigger-sync`
- `POST /api/trigger-sync`
- `POST /api/send-feedback`

## Hosting

This repo is designed for serverless deployment on Vercel. After importing the repo, set the environment variables above and point the frontend `VITE_API_BASE_URL` to the deployed URL.

Deploy shortcut:

- [Import on Vercel](https://vercel.com/new/clone?repository-url=https://github.com/ttaruntej/abif-funding-radar-api)
