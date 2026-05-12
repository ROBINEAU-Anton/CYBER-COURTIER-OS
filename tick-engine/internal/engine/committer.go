package engine

import (
	"context"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"

	"tick-engine/internal/models"
)

// Committer est responsable de la persistance des résultats d'un tick.
type Committer struct {
	pool *pgxpool.Pool
}

// NewCommitter crée un nouveau Committer.
func NewCommitter(pool *pgxpool.Pool) *Committer {
	return &Committer{
		pool: pool,
	}
}

// CommitBatch ouvre une transaction et exécute les requêtes de persistance réelles ou simulées.
func (c *Committer) CommitBatch(ctx context.Context, batch models.ResolutionBatch) error {
	if c.pool == nil {
		// Mode Simulation
		slog.Debug("Committer: Pas de pool de connexion, persistance simulée")
		slog.Info("Début de la transaction SQL (SIMULÉE)")
		for _, res := range batch.Results {
			slog.Info("Simulation SQL : UPDATE action status", "action_id", res.ActionID, "status", string(res.Status))
		}
		for _, evt := range batch.Events {
			slog.Info("Simulation SQL : UPDATE target_server security", "type", evt.Type, "target_server_id", evt.TargetServerID)
		}
		slog.Info("Simulation SQL : INSERT audit log", "actions_resolved", len(batch.Results))
		slog.Info("Transaction SQL validée avec succès (SIMULÉE)")
		return nil
	}

	// Début de la transaction réelle
	tx, err := c.pool.Begin(ctx)
	if err != nil {
		slog.Error("Erreur lors de l'ouverture de la transaction", "error", err)
		return err
	}

	// Sécurisation de la transaction en cas de panique ou d'erreur non gérée
	defer func() {
		if err := tx.Rollback(ctx); err != nil && err.Error() != "tx is closed" {
			slog.Error("Erreur lors du rollback de la transaction", "error", err)
		}
	}()

	// 1. Mise à jour du statut des actions
	for _, res := range batch.Results {
		tagAction, errAction := tx.Exec(ctx, "UPDATE virus_actions SET status = $1 WHERE id = $2", string(res.Status), res.ActionID)
		if errAction != nil {
			slog.Error("Erreur SQL lors de l'UPDATE de l'action", "action_id", res.ActionID, "error", errAction)
			return errAction
		}
		if tagAction.RowsAffected() != 1 {
			slog.Error("Erreur de persistance action", "action_id", res.ActionID, "rows_affected", tagAction.RowsAffected())
			return errAction
		}

		if res.Status == models.StatusSuccess {
			var packetValue, secLevel float64
			errQuery := tx.QueryRow(ctx, `
				SELECT COALESCE(dp.value, 5000), ts.security_level
				FROM virus_actions va
				JOIN data_packets dp ON dp.id = va.packet_id
				JOIN target_servers ts ON ts.id = dp.target_server_id
				WHERE va.id = $1
			`, res.ActionID).Scan(&packetValue, &secLevel)
			
			var gain int
			if errQuery != nil {
				if errQuery.Error() == "no rows in result set" {
					gain = 1000
				} else {
					slog.Error("Erreur SQL lors du calcul du gain", "error", errQuery)
					return errQuery
				}
			} else {
				gain = int(packetValue * (secLevel / 10.0))
			}

			// Créditer le joueur
			tagCred, errCred := tx.Exec(ctx, `
				UPDATE players p
				SET credits = p.credits + $2
				FROM virus_actions va
				WHERE p.id = va.player_id AND va.id = $1
			`, res.ActionID, gain)
			if errCred != nil {
				slog.Error("Erreur SQL lors du crédit du joueur", "action_id", res.ActionID, "error", errCred)
				return errCred
			}
		} else if res.Status == models.StatusAnnihilated {
			// Pénalité 'Trace détectée' si security_level > 20
			tagPen, errPen := tx.Exec(ctx, `
				UPDATE players p
				SET credits = p.credits - 500
				FROM virus_actions va
				JOIN target_servers ts ON ts.id = va.target_server_id
				WHERE p.id = va.player_id AND va.id = $1 AND ts.security_level > 20
			`, res.ActionID)
			if errPen != nil {
				slog.Error("Erreur SQL lors de la pénalité Annihilation", "action_id", res.ActionID, "error", errPen)
				return errPen
			}
		}
	}

	// 2. Traitement des événements système (Augmentation de la sécurité)
	for _, evt := range batch.Events {
		if evt.Type == models.EventSecurityAlert {
			_, err := tx.Exec(ctx, "UPDATE target_servers SET security_level = security_level + 1 WHERE id = $1", evt.TargetServerID)
			if err != nil {
				slog.Error("Erreur SQL lors de l'UPDATE de la sécurité", "target_server_id", evt.TargetServerID, "error", err)
				return err
			}
		}
	}

	// 3. Insertion du log d'audit
	_, err = tx.Exec(ctx, "INSERT INTO audit_logs (actions_resolved, created_at) VALUES ($1, NOW())", len(batch.Results))
	if err != nil {
		slog.Error("Erreur SQL lors de l'INSERT de l'audit log", "error", err)
		return err
	}

	// Validation de la transaction
	errCommit := tx.Commit(ctx)
	if errCommit != nil {
		slog.Error("Erreur lors du commit de la transaction", "error", errCommit)
		return errCommit
	}

	slog.Info("Transaction SQL validée avec succès", "actions_updated", len(batch.Results), "events_processed", len(batch.Events))
	return nil
}
