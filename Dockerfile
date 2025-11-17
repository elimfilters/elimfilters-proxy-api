FROM node:20

WORKDIR /app

COPY package*.json ./

RUN npm install --no-audit --no-fund

RUN npm install morgan --save --no-audit --no-fund

COPY . .

EXPOSE 8080

CMD ["node", "server.js"]

# Updated 2025-11-17
