# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
LABEL version="1.0.0"

WORKDIR /app

COPY package*.json ./
# Installer uniquement les dépendances de production
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

# Variables d'environnement attendues
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/index.js"]
