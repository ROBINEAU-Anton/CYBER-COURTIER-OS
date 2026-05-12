package models

// ActionStatus represents the outcome of an action
type ActionStatus string

const (
	StatusSuccess     ActionStatus = "SUCCESS"
	StatusFailed      ActionStatus = "FAILED"
	StatusAnnihilated ActionStatus = "ANNIHILATED"
)

// VirusAction represents an attack on a data packet
type VirusAction struct {
	ID             string
	PlayerID       string
	TargetServerID string
	PacketID       string // The specific resource being attacked
}

// ActionResult is the outcome for a specific VirusAction
type ActionResult struct {
	ActionID string
	Status   ActionStatus
}

// SystemEvent is an event triggered by the game rules (e.g., security alert)
type SystemEvent struct {
	Type           string
	TargetServerID string
}

const (
	EventSecurityAlert = "SECURITY_ALERT"
)

// ResolutionBatch is the total output of the conflict resolver for a tick
type ResolutionBatch struct {
	Results []ActionResult
	Events  []SystemEvent
}
