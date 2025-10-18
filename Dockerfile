# syntax=docker/dockerfile:1.5
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./

# Instala dependencias sin bloquear por falta de lockfile
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
