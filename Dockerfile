FROM node:18-alpine

WORKDIR /app

COPY apps/backend ./backend
WORKDIR /app/backend

RUN npm install
RUN npx prisma generate
RUN npm run build

EXPOSE 4000

CMD ["node", "dist/src/main.js"]
