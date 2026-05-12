FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:20-alpine
LABEL version="1.0.0"
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist

EXPOSE 80
CMD ["serve", "-s", "dist", "-l", "80"]
