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
			var packetValue, secLevel, gainMultiplier float64
			var targetServerId, playerClass string
			var bonusCredits, bonusXP float64
			errQuery := tx.QueryRow(ctx, `
				SELECT 
					COALESCE(dp.value, 5000), 
					ts.security_level, 
					ts.gain_multiplier, 
					ts.id, 
					COALESCE(p.class, ''),
					(SELECT COALESCE(SUM(bonus_value), 0) FROM player_hardware WHERE player_id = p.id AND bonus_type = 'CREDITS'),
					(SELECT COALESCE(SUM(bonus_value), 0) FROM player_hardware WHERE player_id = p.id AND bonus_type = 'XP')
				FROM virus_actions va
				JOIN data_packets dp ON dp.id = va.packet_id
				JOIN target_servers ts ON ts.id = dp.target_server_id
				JOIN players p ON p.id = va.player_id
				WHERE va.id = $1
			`, res.ActionID).Scan(&packetValue, &secLevel, &gainMultiplier, &targetServerId, &playerClass, &bonusCredits, &bonusXP)
			
			var gain int
			var xpGain int
			if errQuery != nil {
				if errQuery.Error() == "no rows in result set" {
					gain = 1000
					xpGain = 10
				} else {
					slog.Error("Erreur SQL lors du calcul du gain", "error", errQuery)
					return errQuery
				}
			} else {
				gain = int(packetValue * (secLevel / 10.0) * gainMultiplier)
				if playerClass == "BRUTE" {
					gain = int(float64(gain) * 1.5)
				}
				if bonusCredits > 0 {
					gain = int(float64(gain) * (1.0 + (bonusCredits / 100.0)))
				}
				switch targetServerId {
				case "srv-proxy":
					xpGain = 10
				case "srv-mainframe":
					xpGain = 50
				case "srv-vault":
					xpGain = 250
				default:
					xpGain = 10
				}
				if bonusXP > 0 {
					xpGain = int(float64(xpGain) * (1.0 + (bonusXP / 100.0)))
				}
			}

			// Créditer le joueur et ajouter l'XP
			_, errCred := tx.Exec(ctx, `
				UPDATE players p
				SET credits = p.credits + $2,
				    xp = p.xp + $3
				FROM virus_actions va
				WHERE p.id = va.player_id AND va.id = $1
			`, res.ActionID, gain, xpGain)
			if errCred != nil {
				slog.Error("Erreur SQL lors du crédit/XP du joueur", "action_id", res.ActionID, "error", errCred)
				return errCred
			}

			// Gérer le Level-Up (xp >= level * 1000)
			// On utilise une boucle au cas où le joueur gagne assez d'XP pour passer plusieurs niveaux (peu probable ici, mais robuste)
			// ou plus simplement : un seul UPDATE car on gagne max 250 XP
			_, errLvl := tx.Exec(ctx, `
				UPDATE players p
				SET level = p.level + 1,
				    xp = 0
				FROM virus_actions va
				WHERE p.id = va.player_id AND va.id = $1 AND p.xp >= (p.level * 1000)
			`, res.ActionID)
			if errLvl != nil {
				slog.Error("Erreur SQL lors du level-up du joueur", "action_id", res.ActionID, "error", errLvl)
				return errLvl
			}
		} else if res.Status == models.StatusAnnihilated {
			// Pénalité 'Trace détectée' si security_level > 20
			_, errPen := tx.Exec(ctx, `
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
			
			// Pénalité de 20% si srv-vault (réduite à 5% pour GHOST) et modifiée par le Hardware Furtif (-50% pénalité)
			_, errVault := tx.Exec(ctx, `
				UPDATE players p
				SET credits = CAST(p.credits * (
					1.0 - (
						CASE WHEN p.class = 'GHOST' THEN 0.05 ELSE 0.20 END
						* (1.0 - COALESCE((SELECT SUM(bonus_value) FROM player_hardware WHERE player_id = p.id AND bonus_type = 'PENALTY'), 0) / 100.0)
					)
				) AS INTEGER)
				FROM virus_actions va
				WHERE p.id = va.player_id AND va.id = $1 AND va.target_server_id = 'srv-vault'
			`, res.ActionID)
			if errVault != nil {
				slog.Error("Erreur SQL lors de la pénalité Vault", "action_id", res.ActionID, "error", errVault)
				return errVault
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

// ProcessPassiveIncome distribue les crédits passifs générés par le Botnet (si acquis).
func (c *Committer) ProcessPassiveIncome(ctx context.Context) error {
	if c.pool == nil {
		slog.Debug("Committer: Pas de pool, skip passive income")
		return nil
	}

	query := `
		UPDATE players p
		SET credits = p.credits + (
			COALESCE(
				(SELECT level FROM player_upgrades WHERE player_id = p.id AND upgrade_id = 'botnet'), 
				0
			) + 1
		) * 50
	`

	tag, err := c.pool.Exec(ctx, query)
	if err != nil {
		slog.Error("Erreur SQL lors du gain passif (botnet)", "error", err)
		return err
	}

	slog.Info("Gains passifs (Botnet) distribués", "joueurs_affectes", tag.RowsAffected())
	return nil
}
