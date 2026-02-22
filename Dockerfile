FROM node:18-alpine

WORKDIR /app

COPY korana-estate/backend ./backend

WORKDIR /app/backend

RUN npm install
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/main.js"]