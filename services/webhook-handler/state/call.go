package state

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/telnyx/contact-center/webhook-handler/models"
)

const (
	callKeyPrefix = "call:"
	callTTL       = 24 * time.Hour
	pubSubChannel = "telnyx:call-events"
)

type CallStateManager struct {
	redis *redis.Client
}

func NewCallStateManager(redisURL string) (*CallStateManager, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("parse redis URL: %w", err)
	}

	client := redis.NewClient(opts)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		// Redis not available — log warning but don't fail
		// The service can still forward events to Node.js without Redis
		fmt.Printf("WARNING: Redis connection failed: %v. Running without state persistence.\n", err)
	}

	return &CallStateManager{redis: client}, nil
}

// UpdateState processes a Telnyx event and updates call state in Redis.
func (m *CallStateManager) UpdateState(ctx context.Context, event *models.TelnyxCallEvent) (*models.InternalCallState, error) {
	callControlID := event.Payload.CallControlID
	if callControlID == "" {
		return nil, fmt.Errorf("missing call_control_id")
	}

	key := callKeyPrefix + callControlID

	// Get existing state or create new
	state := &models.InternalCallState{
		CallControlID: callControlID,
		CallSessionID: event.Payload.CallSessionID,
		Direction:     event.Payload.Direction,
		From:          event.Payload.From,
		To:            event.Payload.To,
	}

	// Try to get existing state
	existing, err := m.redis.Get(ctx, key).Bytes()
	if err == nil && len(existing) > 0 {
		if err := json.Unmarshal(existing, state); err != nil {
			// Corrupted state — start fresh
			state = &models.InternalCallState{
				CallControlID: callControlID,
				CallSessionID: event.Payload.CallSessionID,
				Direction:     event.Payload.Direction,
				From:          event.Payload.From,
				To:            event.Payload.To,
			}
		}
	}

	// Update state based on event type
	state.State = models.MapTelnyxEventType(event.EventType)

	switch event.EventType {
	case "call.initiated":
		state.State = models.CallStateRinging
		state.StartTime = event.Payload.StartTime
	case "call.answered":
		state.State = models.CallStateAnswered
		state.AnswerTime = event.Payload.AnswerTime
	case "call.hangup":
		state.State = models.CallStateEnded
		state.EndTime = event.Payload.EndTime
		state.Disposition = event.Payload.HangupCause
	case "call.bridged":
		state.State = models.CallStateAnswered
	case "call.hold":
		state.State = models.CallStateOnHold
	case "call.unhold":
		state.State = models.CallStateAnswered
	case "call.transferred":
		state.State = models.CallStateTransferred
	}

	// Save to Redis
	data, err := json.Marshal(state)
	if err != nil {
		return nil, fmt.Errorf("marshal state: %w", err)
	}
	if err := m.redis.Set(ctx, key, data, callTTL).Err(); err != nil {
		return nil, fmt.Errorf("save state: %w", err)
	}

	// Publish event (best-effort)
	msg, _ := json.Marshal(models.ForwardedEvent{
		EventType: event.EventType,
		CallState: state,
		Timestamp: time.Now(),
	})
	m.redis.Publish(ctx, pubSubChannel, msg)

	return state, nil
}

// GetState retrieves call state from Redis.
func (m *CallStateManager) GetState(ctx context.Context, callControlID string) (*models.InternalCallState, error) {
	key := callKeyPrefix + callControlID
	data, err := m.redis.Get(ctx, key).Bytes()
	if err != nil {
		return nil, err
	}
	var state models.InternalCallState
	if err := json.Unmarshal(data, &state); err != nil {
		return nil, err
	}
	return &state, nil
}

// SetAgentID assigns an agent to a call.
func (m *CallStateManager) SetAgentID(ctx context.Context, callControlID, agentID string) error {
	state, err := m.GetState(ctx, callControlID)
	if err != nil {
		return err
	}
	state.AgentID = agentID
	data, _ := json.Marshal(state)
	return m.redis.Set(ctx, callKeyPrefix+callControlID, data, callTTL).Err()
}

// SetQueueID assigns a queue to a call.
func (m *CallStateManager) SetQueueID(ctx context.Context, callControlID, queueID string) error {
	state, err := m.GetState(ctx, callControlID)
	if err != nil {
		return err
	}
	state.QueueID = queueID
	data, _ := json.Marshal(state)
	return m.redis.Set(ctx, callKeyPrefix+callControlID, data, callTTL).Err()
}

// Close closes the Redis connection.
func (m *CallStateManager) Close() error {
	return m.redis.Close()
}
