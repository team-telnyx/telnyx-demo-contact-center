package forward

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/telnyx/contact-center/webhook-handler/models"
)

type NodeForwarder struct {
	client    *http.Client
	serverURL string
	apiKey    string
}

func NewNodeForwarder(serverURL, apiKey string) *NodeForwarder {
	return &NodeForwarder{
		client: &http.Client{
			Timeout: 5 * time.Second,
		},
		serverURL: serverURL,
		apiKey:    apiKey,
	}
}

// ForwardEvent sends a validated event to the Node.js server.
func (f *NodeForwarder) ForwardEvent(event *models.ForwardedEvent) error {
	payload, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshal event: %w", err)
	}

	url := f.serverURL + "/api/webhooks/telnyx/internal"
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if f.apiKey != "" {
		req.Header.Set("X-Internal-API-Key", f.apiKey)
	}

	resp, err := f.client.Do(req)
	if err != nil {
		return fmt.Errorf("forward request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("forward failed (status %d): %s", resp.StatusCode, string(body))
	}

	return nil
}
