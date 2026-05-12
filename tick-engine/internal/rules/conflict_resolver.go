package rules

import "tick-engine/internal/models"

// ResolveConflicts applique la règle de l'Annihilation Mutuelle.
// Si une attaque cible un paquet dans le tick -> Succès
// Si >1 attaque cible le même paquet dans le tick -> Échec (Annihilation) et Alerte Sécurité.
func ResolveConflicts(actions []models.VirusAction) models.ResolutionBatch {
	// Regroupement par PacketID
	groupedActions := make(map[string][]models.VirusAction)
	for _, action := range actions {
		groupedActions[action.PacketID] = append(groupedActions[action.PacketID], action)
	}

	var batch models.ResolutionBatch

	// Résolution
	for _, group := range groupedActions {
		if len(group) == 1 {
			// Une seule attaque : succès
			batch.Results = append(batch.Results, models.ActionResult{
				ActionID: group[0].ID,
				Status:   models.StatusSuccess,
			})
		} else if len(group) > 1 {
			// Annihilation Mutuelle
			for _, action := range group {
				batch.Results = append(batch.Results, models.ActionResult{
					ActionID: action.ID,
					Status:   models.StatusAnnihilated,
				})
			}
			// Génération de l'événement de sécurité
			batch.Events = append(batch.Events, models.SystemEvent{
				Type:           models.EventSecurityAlert,
				TargetServerID: group[0].TargetServerID,
			})
		}
	}

	return batch
}
