package rules

import (
	"testing"
	"tick-engine/internal/models"
)

func TestResolveConflicts_SingleAttack(t *testing.T) {
	actions := []models.VirusAction{
		{ID: "A1", TargetServerID: "SRV_1", PacketID: "PKT_A"},
	}

	batch := ResolveConflicts(actions)

	if len(batch.Results) != 1 {
		t.Fatalf("Expected 1 result, got %d", len(batch.Results))
	}
	if batch.Results[0].Status != models.StatusSuccess {
		t.Errorf("Expected status SUCCESS, got %s", batch.Results[0].Status)
	}
	if len(batch.Events) != 0 {
		t.Errorf("Expected 0 events, got %d", len(batch.Events))
	}
}

func TestResolveConflicts_TwoAttacks(t *testing.T) {
	actions := []models.VirusAction{
		{ID: "A1", TargetServerID: "SRV_1", PacketID: "PKT_A"},
		{ID: "A2", TargetServerID: "SRV_1", PacketID: "PKT_A"},
	}

	batch := ResolveConflicts(actions)

	if len(batch.Results) != 2 {
		t.Fatalf("Expected 2 results, got %d", len(batch.Results))
	}
	
	for _, res := range batch.Results {
		if res.Status != models.StatusAnnihilated {
			t.Errorf("Action %s expected ANNIHILATED, got %s", res.ActionID, res.Status)
		}
	}

	if len(batch.Events) != 1 {
		t.Fatalf("Expected 1 security event, got %d", len(batch.Events))
	}
	if batch.Events[0].Type != models.EventSecurityAlert {
		t.Errorf("Expected event SECURITY_ALERT, got %s", batch.Events[0].Type)
	}
	if batch.Events[0].TargetServerID != "SRV_1" {
		t.Errorf("Expected target server SRV_1, got %s", batch.Events[0].TargetServerID)
	}
}

func TestResolveConflicts_ThreeAttacksAndOneAttack(t *testing.T) {
	actions := []models.VirusAction{
		{ID: "A1", TargetServerID: "SRV_1", PacketID: "PKT_A"}, 
		{ID: "A2", TargetServerID: "SRV_1", PacketID: "PKT_A"}, 
		{ID: "A3", TargetServerID: "SRV_1", PacketID: "PKT_A"}, 
		{ID: "A4", TargetServerID: "SRV_2", PacketID: "PKT_B"}, 
	}

	batch := ResolveConflicts(actions)

	if len(batch.Results) != 4 {
		t.Fatalf("Expected 4 results, got %d", len(batch.Results))
	}

	resultsMap := make(map[string]models.ActionStatus)
	for _, res := range batch.Results {
		resultsMap[res.ActionID] = res.Status
	}

	if resultsMap["A1"] != models.StatusAnnihilated ||
		resultsMap["A2"] != models.StatusAnnihilated ||
		resultsMap["A3"] != models.StatusAnnihilated {
		t.Errorf("Expected A1, A2, A3 to be ANNIHILATED")
	}

	if resultsMap["A4"] != models.StatusSuccess {
		t.Errorf("Expected A4 to be SUCCESS, got %s", resultsMap["A4"])
	}

	if len(batch.Events) != 1 {
		t.Fatalf("Expected 1 security event, got %d", len(batch.Events))
	}
	if batch.Events[0].TargetServerID != "SRV_1" {
		t.Errorf("Expected security alert on SRV_1, got %s", batch.Events[0].TargetServerID)
	}
}
