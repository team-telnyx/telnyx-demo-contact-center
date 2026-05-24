package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port             string
	NodeServerURL    string
	RedisURL         string
	TelnyxPublicKey  string
	InternalAPIKey   string
	MaxRequestSize   int64
	ShutdownTimeout  int
}

func Load() *Config {
	return &Config{
		Port:            getEnv("PORT", "8090"),
		NodeServerURL:   getEnv("NODE_SERVER_URL", "http://localhost:3001"),
		RedisURL:        getEnv("REDIS_URL", "redis://localhost:6379"),
		TelnyxPublicKey:  getEnv("TELNYX_PUBLIC_KEY", ""),
		InternalAPIKey:   getEnv("INTERNAL_API_KEY", ""),
		MaxRequestSize:   getEnvInt64("MAX_REQUEST_SIZE", 1048576), // 1MB
		ShutdownTimeout:  getEnvInt("SHUTDOWN_TIMEOUT", 10),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	i, _ := strconv.Atoi(v)
	return i
}

func getEnvInt64(key string, fallback int64) int64 {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	i, _ := strconv.ParseInt(v, 10, 64)
	return i
}
