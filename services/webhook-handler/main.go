package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/telnyx/contact-center/webhook-handler/config"
	"github.com/telnyx/contact-center/webhook-handler/forward"
	"github.com/telnyx/contact-center/webhook-handler/handler"
	"github.com/telnyx/contact-center/webhook-handler/middleware"
	state "github.com/telnyx/contact-center/webhook-handler/state"
)

func main() {
	cfg := config.Load()

	// Initialize call state manager (Redis)
	stateMgr, err := state.NewCallStateManager(cfg.RedisURL)
	if err != nil {
		log.Printf("WARN: Redis state manager not available: %v", err)
	}
	if stateMgr != nil {
		defer stateMgr.Close()
	}

	// Initialize Node.js forwarder
	forwarder := forward.NewNodeForwarder(cfg.NodeServerURL, cfg.InternalAPIKey)

	// Initialize webhook handler
	wh := handler.NewWebhookHandler(cfg.TelnyxPublicKey, stateMgr, forwarder)

	// Create HTTP mux
	mux := http.NewServeMux()
	mux.HandleFunc("POST /webhooks/telnyx", wh.HandleTelnyxWebhook)
	mux.HandleFunc("GET /health", wh.HealthCheck)

	// Apply middleware
	var h http.Handler = mux
	h = middleware.RequestLogger(h)

	// Create server
	addr := fmt.Sprintf(":%s", cfg.Port)
	server := &http.Server{
		Addr:           addr,
		Handler:        h,
		ReadTimeout:    10 * time.Second,
		WriteTimeout:   10 * time.Second,
		IdleTimeout:    60 * time.Second,
		MaxHeaderBytes: 1 << 20, // 1MB
	}

	// Start server
	go func() {
		log.Printf("Webhook handler listening on %s", addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(cfg.ShutdownTimeout)*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Forced shutdown: %v", err)
	}
	log.Println("Server stopped")
}
