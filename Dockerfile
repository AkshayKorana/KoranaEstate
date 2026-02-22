FROM node:18-alpine

WORKDIR /app

# Copy only backend
COPY korana-estate/backend ./backend

WORKDIR /app/backend

RUN npm install

EXPOSE 3000

CMD ["npm", "run", "start"]