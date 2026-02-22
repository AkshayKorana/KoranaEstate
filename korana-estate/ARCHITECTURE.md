# Korana Estate Architecture

## Monorepo

- `backend/`: NestJS API, Prisma ORM, Supabase Postgres, backend-managed Supabase Storage/Realtime
- `web/`: Next.js App Router frontend using REST only
- `mobile/`: Expo React Native (Android + iOS) using REST only
- `packages/shared/`: shared type contracts

## Security Guarantees

- JWT auth in backend
- Role guards for route authorization
- DTO validation via `class-validator`
- Global exception filter
- Global rate limit (`@nestjs/throttler`)
- CORS explicitly configured
- Service-role key backend only

## Scaling Readiness

- Modular domain architecture
- Normalized schema with FK indexes
- Soft delete on products/users
- Order lifecycle enum and status transitions
- Chat tables designed for realtime fanout
- Market data model optimized for time-series chart queries

## Next Production Steps

1. Add refresh-token rotation + revoke table
2. Add OpenAPI docs + API contract tests
3. Add background workers for market ingestion and forecasting
4. Add websocket gateway for backend-owned realtime bridge
5. Add CI: lint, test, prisma migrate check, e2e smoke
