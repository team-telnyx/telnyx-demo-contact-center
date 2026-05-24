package verify

import (
	"crypto/ed25519"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"time"
)

// VerifyTelnyxSignature verifies the Telnyx webhook signature.
//
// Telnyx uses Ed25519 signatures with two separate headers:
//   - telnyx-signature-ed25519: base64-encoded Ed25519 signature
//   - telnyx-timestamp: unix timestamp in seconds
//
// The signed payload is: `${timestamp}|${rawBody}`
// (pipe separator, matching the Node.js verifyTelnyxSignature middleware).
//
// The public key is the base64-encoded raw 32-byte Ed25519 public key
// from the Telnyx portal.
func VerifyTelnyxSignature(publicKeyStr, signatureHeader, timestampHeader string, body []byte) error {
	if publicKeyStr == "" {
		// No public key configured — skip verification (dev mode)
		return nil
	}

	if signatureHeader == "" || timestampHeader == "" {
		return errors.New("missing signature or timestamp header")
	}

	// Check timestamp freshness (5 minute window, matching Node.js implementation)
	ts, err := strconv.ParseInt(timestampHeader, 10, 64)
	if err != nil {
		return fmt.Errorf("invalid timestamp: %w", err)
	}
	now := time.Now().Unix()
	age := now - ts
	if age < 0 {
		age = -age
	}
	if age > 300 {
		return errors.New("stale or invalid timestamp")
	}

	// Decode public key: raw 32-byte Ed25519 key, base64-encoded
	publicKey, err := decodePublicKey(publicKeyStr)
	if err != nil {
		return fmt.Errorf("decode public key: %w", err)
	}

	// Decode signature
	sigBytes, err := base64.StdEncoding.DecodeString(signatureHeader)
	if err != nil {
		return fmt.Errorf("decode signature: %w", err)
	}

	// Construct the signed payload: timestamp|body
	// (pipe separator, matching Node.js implementation: Buffer.concat([Buffer.from(`${timestamp}|`), rawBody]))
	signedPayload := append([]byte(timestampHeader+"|"), body...)

	// Verify
	if !ed25519.Verify(publicKey, signedPayload, sigBytes) {
		return errors.New("invalid signature")
	}

	return nil
}

func decodePublicKey(keyStr string) (ed25519.PublicKey, error) {
	keyBytes, err := base64.StdEncoding.DecodeString(keyStr)
	if err != nil {
		return nil, fmt.Errorf("base64 decode failed: %w", err)
	}
	if len(keyBytes) != ed25519.PublicKeySize {
		return nil, fmt.Errorf("invalid public key size: got %d, want %d", len(keyBytes), ed25519.PublicKeySize)
	}
	return ed25519.PublicKey(keyBytes), nil
}
