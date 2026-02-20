# Automated Data + Model Pipeline

This project now supports automated ingestion and model refresh with minimal manual intervention.

## Pipeline Endpoint

- `POST /api/jobs/pipeline`
- Protected by `Authorization: Bearer <CRON_SECRET>`
- Runs, in order:
1. `/api/market` (web benchmark ingestion)
2. `/api/price-intel` (normalized multi-source refresh)
3. `/api/forecast` (3/7/14 horizon model outputs + persisted metrics)
4. `/api/model-leaderboard` (linear-v1 vs hybrid-v2 OOS ranking)

## Required Environment Variables

Add these in deployment:

```env
CRON_SECRET=your-long-random-secret
USD_TO_INR=83
```

## Option A: Vercel Cron (recommended on Vercel)

- `vercel.json` is configured for every 6 hours:
  - `0 */6 * * *` -> `/api/jobs/pipeline`
- Ensure `CRON_SECRET` is set in Vercel env.

## Option B: GitHub Actions Scheduler

Workflow file: `.github/workflows/automated-pipeline.yml`

Set repository secrets:
- `APP_URL` (example: `https://your-app.vercel.app`)
- `CRON_SECRET` (same value as runtime env)

This workflow triggers every 6 hours and can also be run manually.

## Manual Trigger

```bash
curl -X POST "https://<your-domain>/api/jobs/pipeline" \
  -H "Authorization: Bearer <CRON_SECRET>"
```
