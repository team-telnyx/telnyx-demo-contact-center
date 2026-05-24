package handler

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/telnyx/contact-center/webhook-handler/forward"
	"github.com/telnyx/contact-center/webhook-handler/models"
	"github.com/telnyx/contact-center/webhook-handler/state"
	"github.com/telnyx/contact-center/webhook-handler/verify"
)

type WebhookHandler struct {
	publicKey string
	stateMgr  *state.CallStateManager
	forwarder *forward.NodeForwarder
}

func NewWebhookHandler(publicKey string, stateMgr *state.CallStateManager, forwarder *forward.NodeForwarder) *WebhookHandler {
	return &WebhookHandler{
		publicKey: publicKey,
		stateMgr:  stateMgr,
		forwarder: forwarder,
	}
}

func (h *WebhookHandler) HandleTelnyxWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Read raw body (needed for signature verification)
	body, err := io.ReadAll(r.Body)
	if err != nil {
		log.Printf("ERROR: read body: %v", err)
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	// Verify signature using separate headers (matching Node.js implementation)
	sigHeader := r.Header.Get("telnyx-signature-ed25519")
	tsHeader := r.Header.Get("telnyx-timestamp")
	if err := verify.VerifyTelnyxSignature(h.publicKey, sigHeader, tsHeader, body); err != nil {
		log.Printf("WARN: signature verification failed: %v", err)
		// In production, reject. For now, log and continue (dev mode).
		// http.Error(w, "unauthorized", http.StatusUnauthorized)
		// return
	}

	// Parse the Telnyx v2 envelope: { data: { event_type, id, payload: {...} } }
	var envelope models.TelnyxWebhookEnvelope
	if err := json.Unmarshal(body, &envelope); err != nil {
		log.Printf("ERROR: parse envelope: %v", err)
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	// Flatten to our internal event format (matching Node.js server's pattern)
	event := &models.TelnyxCallEvent{
		EventType:  envelope.Data.EventType,
		EventID:    envelope.Data.ID,
		OccurredAt: envelope.Data.OccurredAt,
		RecordType: envelope.Data.RecordType,
		Payload:    envelope.Data.Payload,
	}

	if event.EventType == "" {
		log.Printf("WARN: missing event_type in webhook payload")
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	log.Printf("Received event: %s (call: %s)", event.EventType, event.Payload.CallControlID)

	// Update call state in Redis
	var callState *models.InternalCallState
	if h.stateMgr != nil {
		callState, err = h.stateMgr.UpdateState(r.Context(), event)
		if err != nil {
			log.Printf("WARN: state update failed: %v", err)
			// Continue — state management failure shouldn't block webhook processing
		}
	}

	// Forward to Node.js server
	fwdEvent := &models.ForwardedEvent{
		EventType: event.EventType,
		RawEvent:  event,
		CallState: callState,
		Timestamp: time.Now(),
	}
	if err := h.forwarder.ForwardEvent(fwdEvent); err != nil {
		log.Printf("ERROR: forward to node: %v", err)
		// Still return 200 to Telnyx — they shouldn't retry because our backend is down
	}

	// Respond 200 OK to Telnyx
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// HealthCheck returns the service health status.
func (h *WebhookHandler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "healthy",
		"service": "webhook-handler",
	})
}
