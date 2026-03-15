FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash python3 python3-venv python3-pip ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY apps/backend ./backend
COPY services/price-collector ./services/price-collector

WORKDIR /app/backend

RUN npm install
RUN npx prisma generate
RUN npm run build

RUN PLAYWRIGHT_INSTALL_ARGS="chromium" /app/services/price-collector/setup.sh
EXPOSE 4000

CMD ["node", "dist/src/main.js"]
