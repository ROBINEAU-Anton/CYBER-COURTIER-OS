package engine

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
	"tick-engine/internal/models"
	"tick-engine/internal/rules"
)

// TickEngine est responsable de l'orchestration de la boucle de jeu.
type TickEngine struct {
	tickDuration time.Duration
	redisClient  *redis.Client
	committer    *Committer
}

// NewTickEngine crée un nouveau TickEngine avec la durée de tick spécifiée.
func NewTickEngine(duration time.Duration, rdb *redis.Client, committer *Committer) *TickEngine {
	return &TickEngine{
		tickDuration: duration,
		redisClient:  rdb,
		committer:    committer,
	}
}

// Start lance la boucle temporelle et écoute le time.Ticker.
// La boucle s'arrête proprement si le contexte est annulé.
func (e *TickEngine) Start(ctx context.Context) {
	ticker := time.NewTicker(e.tickDuration)
	defer ticker.Stop()

	slog.Info("TickEngine started", "tick_duration", e.tickDuration)

	for {
		select {
		case <-ctx.Done():
			slog.Info("TickEngine shutting down (Graceful Shutdown)...")
			return
		case <-ticker.C:
			e.processTick(ctx)
		}
	}
}

// processTick est appelé à chaque itération de la boucle temporelle.
func (e *TickEngine) processTick(ctx context.Context) {
	slog.Info("Tick exécuté, récupération des actions...")

	// 1. Lire toutes les actions dans la file Redis (LRANGE actions_queue 0 -1)
	rawActions, err := e.redisClient.LRange(ctx, "actions_queue", 0, -1).Result()
	if err != nil {
		slog.Error("Erreur lors de la lecture de la file Redis", "error", err)
		return
	}

	if len(rawActions) == 0 {
		return // Rien à traiter
	}

	// LTRIM actions_queue 1 0 (Vide la file pour éviter de retraiter les mêmes actions)
	err = e.redisClient.LTrim(ctx, "actions_queue", 1, 0).Err()
	if err != nil {
		slog.Error("Erreur lors du nettoyage de la file Redis", "error", err)
		return
	}

	// 2. Désérialiser les actions JSON en un slice de models.VirusAction
	var actions []models.VirusAction
	for _, raw := range rawActions {
		var action models.VirusAction
		if err := json.Unmarshal([]byte(raw), &action); err != nil {
			slog.Error("Erreur de désérialisation d'une action", "raw", raw, "error", err)
			continue
		}
		actions = append(actions, action)
	}

	if len(actions) == 0 {
		return
	}

	// 3. Appeler la règle métier rules.ResolveConflicts
	batch := rules.ResolveConflicts(actions)

	// 4. Loguer les résultats de manière structurée
	slog.Info("Résolution des conflits terminée",
		"actions_processed", len(actions),
		"results_count", len(batch.Results),
		"events_count", len(batch.Events),
		"results", batch.Results,
		"events", batch.Events,
	)

	// 5. Persister les résultats via le Committer
	if err := e.committer.CommitBatch(ctx, batch); err != nil {
		slog.Error("Erreur lors de la persistance du batch", "error", err)
	}
}
