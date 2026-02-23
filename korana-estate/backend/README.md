# Korana Estate Backend (NestJS)

## API Base

- `http://localhost:4000/api/v1`
- Swagger docs: `http://localhost:4000/api/docs`

## Modules

- Auth: `/api/v1/auth`
- Users: `/api/v1/users`
- Marketplace: `/api/v1/marketplace`
- Store: `/api/v1/store`
- Orders: `/api/v1/orders`
- Chat: `/api/v1/chat`
- Market Intelligence: `/api/v1/market-intelligence`
- Subscriptions: `/api/v1/subscriptions`
- Payments: `/api/v1/payments`
- Admin: `/api/v1/admin`

## Auth Tokens

- Access token: 15 minutes (`ACCESS_JWT_SECRET`)
- Refresh token: 30 days (`REFRESH_JWT_SECRET`)
- Refresh endpoint: `POST /api/v1/auth/refresh`
- Logout endpoint: `POST /api/v1/auth/logout`

## Monetization

- Global commission rate (admin): `PATCH /api/v1/orders/commission-rate`
- Order stores: `commissionRate`, `platformFee`, `sellerPayout`
- PRO-only advanced intelligence: `GET /api/v1/market-intelligence/:commodityName/advanced`
- Payment webhook: `POST /api/v1/payments/webhook`
- Admin metrics: `GET /api/v1/admin/metrics`
- Admin payout release: `PATCH /api/v1/admin/payouts/:payoutId/release`
- Admin payout hold: `PATCH /api/v1/admin/payouts/:payoutId/hold`
- Raise dispute: `POST /api/v1/orders/:orderId/dispute`
- Admin disputes list: `GET /api/v1/admin/disputes`
- Admin dispute resolve: `PATCH /api/v1/admin/disputes/:id/resolve`
- Buyer confirm order: `PATCH /api/v1/orders/:orderId/confirm`
- Order review: `POST /api/v1/orders/:orderId/review`
- User reputation: `GET /api/v1/users/:id/reputation`
- Admin user verify: `PATCH /api/v1/admin/users/:id/verify`

## Production Rules

- Frontends call backend only.
- Backend owns Prisma + Supabase access.
- No Supabase service role key exposed to clients.

## Setup

1. Copy `.env.example` to `.env`
2. Set Supabase Postgres `DATABASE_URL`
3. Run:

```bash
npm install
npm run prisma:generate -w backend
npm run prisma:migrate -w backend
npm run dev:backend
```

## Realtime

Use Supabase Realtime in backend for fanout to clients via backend-managed channels or websocket gateway.
