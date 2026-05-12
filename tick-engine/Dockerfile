# Stage 1 : Build
FROM golang:1.25-alpine AS builder

# Définition du répertoire de travail
WORKDIR /app

# Copie des fichiers de modules et téléchargement des dépendances
COPY go.mod go.sum ./
RUN go mod download

# Copie du reste du code source
COPY . .

# Build de l'exécutable
# CGO_ENABLED=0 permet d'avoir un binaire statique (parfait pour Alpine)
RUN CGO_ENABLED=0 GOOS=linux go build -o worker ./cmd/worker

# Stage 2 : Image finale (légère)
FROM alpine:latest
LABEL version="1.0.0"
WORKDIR /root/

# Ajout des certificats racine (utile si connexion sécurisée externe plus tard)
RUN apk --no-cache add ca-certificates

# Copie du binaire depuis le stage de build
COPY --from=builder /app/worker .

# Commande de démarrage
CMD ["./worker"]
