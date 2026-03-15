FROM node:20-bookworm-slim

WORKDIR /app

ENV SCRAPER_BROWSER=firefox

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    python3 \
    python3-venv \
    python3-pip \
    ca-certificates \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libatspi2.0-0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libxcb1 \
    libxkbcommon0 \
    libasound2 \
  && rm -rf /var/lib/apt/lists/*

COPY apps/backend ./backend
COPY services/price-collector ./services/price-collector

WORKDIR /app/backend

RUN npm install
RUN npx prisma generate
RUN npm run build

RUN /app/services/price-collector/setup.sh
EXPOSE 4000

CMD ["node", "dist/src/main.js"]
