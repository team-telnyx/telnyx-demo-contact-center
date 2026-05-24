package models

import "time"

// TelnyxWebhookEnvelope is the top-level Telnyx v2 webhook envelope.
type TelnyxWebhookEnvelope struct {
	Data TelnyxWebhookData `json:"data"`
}

// TelnyxWebhookData contains the event metadata and payload.
type TelnyxWebhookData struct {
	EventType  string          `json:"event_type"`
	ID         string          `json:"id"`
	OccurredAt time.Time       `json:"occurred_at"`
	RecordType string          `json:"record_type"`
	Payload    TelnyxCallPayload `json:"payload"`
}

// TelnyxCallPayload represents the payload of a Telnyx Call Control webhook event.
type TelnyxCallPayload struct {
	CallControlID  string                 `json:"call_control_id"`
	CallSessionID  string                 `json:"call_session_id"`
	CallLegID      string                 `json:"call_leg_id"`
	Direction      string                 `json:"direction"`
	From           string                 `json:"from"`
	To             string                 `json:"to"`
	State          string                 `json:"state"`
	StartTime      *time.Time             `json:"start_time"`
	AnswerTime     *time.Time             `json:"answer_time"`
	EndTime        *time.Time             `json:"end_time"`
	Duration       int                    `json:"duration"`
	HangupCause    string                 `json:"hangup_cause"`
	HangupSource   string                 `json:"hangup_source"`
	ClientState    string                 `json:"client_state"`
	CallerIDName   string                 `json:"caller_id_name"`
	CallerIDNumber string                 `json:"caller_id_number"`
	DialAttempts   int                    `json:"dial_attempts"`
	IsAlive        bool                   `json:"is_alive"`
	Metadata       map[string]interface{} `json:"metadata"`
	Digit          string                 `json:"digit,omitempty"`
	Digits         string                 `json:"digits,omitempty"`
	Text           string                 `json:"text,omitempty"`
	Result         string                 `json:"result,omitempty"`
	RecordingURL   string                 `json:"recording_url,omitempty"`
	// Additional fields for specific events
	Conference  *ConferencePayload  `json:"conference,omitempty"`
	Recording   *RecordingPayload   `json:"recording,omitempty"`
	Fax         *FaxPayload         `json:"fax,omitempty"`
	CallDetails *CallDetailsPayload `json:"call_details,omitempty"`
	// SMS-specific fields (different JSON keys to avoid clash with call from/to)
	FromPhone string `json:"from_phone,omitempty"`
	ToPhone   []struct {
		PhoneNumber string `json:"phone_number"`
	} `json:"to_phones,omitempty"`
	Body string `json:"body,omitempty"`
}

type ConferencePayload struct {
	ConferenceID string `json:"conference_id"`
	Name         string `json:"name"`
}

type RecordingPayload struct {
	RecordingID     string `json:"recording_id"`
	RecordingURL    string `json:"recording_url"`
	DurationSeconds int    `json:"duration_seconds"`
}

type FaxPayload struct {
	FaxID  string `json:"fax_id"`
	Status string `json:"status"`
}

type CallDetailsPayload struct {
	Disposition string `json:"disposition"`
}

// TelnyxCallEvent is a flattened event for easier downstream consumption,
// matching the format the Node.js server currently uses internally.
type TelnyxCallEvent struct {
	EventType     string            `json:"event_type"`
	EventID       string            `json:"event_id"`
	OccurredAt    time.Time         `json:"occurred_at"`
	RecordType    string            `json:"record_type"`
	Payload       TelnyxCallPayload `json:"payload"`
}

// InternalCallState is our representation of active call state.
type InternalCallState struct {
	CallControlID  string            `json:"call_control_id"`
	CallSessionID  string            `json:"call_session_id"`
	Direction      string            `json:"direction"`
	From           string            `json:"from"`
	To             string            `json:"to"`
	State          CallState         `json:"state"`
	StartTime      *time.Time        `json:"start_time"`
	AnswerTime     *time.Time        `json:"answer_time"`
	EndTime        *time.Time        `json:"end_time"`
	AgentID        string            `json:"agent_id,omitempty"`
	QueueID        string            `json:"queue_id,omitempty"`
	ContactID      string            `json:"contact_id,omitempty"`
	Disposition    string            `json:"disposition,omitempty"`
	Tags           []string          `json:"tags,omitempty"`
	Metadata       map[string]string `json:"metadata,omitempty"`
}

type CallState string

const (
	CallStateRinging     CallState = "ringing"
	CallStateAnswered    CallState = "answered"
	CallStateOnHold      CallState = "on_hold"
	CallStateTransferred CallState = "transferred"
	CallStateEnded       CallState = "ended"
)

// ForwardedEvent is sent to the Node.js server.
type ForwardedEvent struct {
	EventType string           `json:"event_type"`
	CallState *InternalCallState `json:"call_state,omitempty"`
	RawEvent  *TelnyxCallEvent   `json:"raw_event,omitempty"`
	Timestamp time.Time        `json:"timestamp"`
}

// MapTelnyxEventType maps Telnyx event types to our call states.
func MapTelnyxEventType(eventType string) CallState {
	switch eventType {
	case "call.initiated":
		return CallStateRinging
	case "call.answered":
		return CallStateAnswered
	case "call.bridged":
		return CallStateAnswered
	case "call.hold":
		return CallStateOnHold
	case "call.unhold":
		return CallStateAnswered
	case "call.transferred":
		return CallStateTransferred
	case "call.hangup":
		return CallStateEnded
	default:
		return CallStateEnded
	}
}
