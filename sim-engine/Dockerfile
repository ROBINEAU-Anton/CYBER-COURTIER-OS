FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine
LABEL version="2.0.0"
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY --from=builder /app/dist ./dist

CMD ["npm", "start"]
