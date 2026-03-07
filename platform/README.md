# Korana Estate Monorepo

Production-oriented SaaS architecture:

- `backend`: NestJS API + Prisma + Supabase Postgres
- `web`: Next.js App Router frontend (REST to backend)
- `mobile`: Expo React Native app (REST to backend)
- `packages/shared`: shared types/contracts

## Key Rule

Frontends do **not** access Supabase directly. All business/data access goes through backend API.
