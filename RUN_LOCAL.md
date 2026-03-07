# Local Run Guide (Web + Backend)

This repository currently contains two runnable apps:

- Web app (Next.js): `apps/web`
- Backend (NestJS): `apps/backend`

To avoid breakage, run each app with its own Prisma schema.

## 1) Prerequisites

- Node.js 20 LTS
- npm 10+

## 2) First-time setup on any laptop

```bash
git pull origin main
npm run setup:all
```

## 3) Run Web App (Next.js)

```bash
npm run dev:web
```

What this does:

- Runs `apps/web` Next.js dev server on port 3000

## 4) Run Backend (NestJS)

```bash
npm run dev:backend
```

What this does:

- Generates Prisma client from `apps/backend/prisma/schema.prisma`
- Starts Nest backend in watch mode

## 5) If port/lock error happens

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
kill <PID>
rm -f .next/dev/lock
```

Then run `npm run dev:web` again.

### Windows PowerShell quick fix

```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item -Recurse -Force .next
npm run dev:web
```

## 6) Important safety rule

Do not run the legacy root `app/` dashboard. Active dashboard is only under `apps/web`.

## 7) Useful scripts

```bash
npm run prisma:generate:backend
npm run doctor
```
