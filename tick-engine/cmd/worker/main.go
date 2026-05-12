package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"tick-engine/internal/engine"
	"tick-engine/internal/infrastructure/cache"
	"tick-engine/internal/infrastructure/database"
)

func main() {
	// Configuration du logger structuré
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	slog.Info("Initialisation du worker...")

	// Initialisation de Redis via la variable d'environnement REDIS_URL
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379"
	}
	
	redisClient, err := cache.NewRedisClient(redisURL)
	if err != nil {
		slog.Error("Impossible d'initialiser le client Redis", "error", err)
		os.Exit(1)
	}
	defer redisClient.Close()
	
	slog.Info("Connexion Redis configurée", "url", redisURL)

	// Initialisation de PostgreSQL
	dbURL := os.Getenv("DATABASE_URL")
	var committer *engine.Committer
	if dbURL == "" {
		slog.Info("Connexion DB ignorée pour le moment (DATABASE_URL vide)")
		committer = engine.NewCommitter(nil)
	} else {
		dbPool, err := database.NewDBPool(dbURL)
		if err != nil {
			slog.Error("Impossible d'initialiser le pool PostgreSQL", "error", err)
			os.Exit(1)
		}
		defer dbPool.Close()
		slog.Info("Connexion PostgreSQL configurée")
		committer = engine.NewCommitter(dbPool)
	}

	// Création du contexte pour gérer le Graceful Shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Écoute des signaux d'interruption système (SIGINT, SIGTERM)
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		sig := <-sigChan
		slog.Info("Signal reçu, arrêt en cours...", "signal", sig)
		cancel() // Annule le contexte, ce qui arrêtera le TickEngine
	}()

	// Instanciation du TickEngine avec une durée de 1 seconde et le client Redis et Committer
	tickDuration := 1 * time.Second
	tickEngine := engine.NewTickEngine(tickDuration, redisClient, committer)

	// Lancement du moteur (bloquant jusqu'à l'annulation du contexte)
	tickEngine.Start(ctx)

	slog.Info("Worker arrêté proprement.")
}
