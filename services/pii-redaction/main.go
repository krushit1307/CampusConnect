package main

import (
	"context"
	"encoding/json"
	"log"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

type redactRequest struct {
	Content string `json:"content"`
}

type inboundPayload struct {
	Content string `json:"content"`
	EventID string `json:"event_id"`
	UserID  string `json:"user_id"`
}

func redactHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req redactRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(Redact(req.Content))
}

func redisCommand(conn net.Conn, args ...string) (string, error) {
	var b strings.Builder
	b.WriteByte('*')
	b.WriteString(strconv.Itoa(len(args)))
	b.WriteString("\r\n")
	for _, arg := range args {
		b.WriteByte('$')
		b.WriteString(strconv.Itoa(len(arg)))
		b.WriteString("\r\n")
		b.WriteString(arg)
		b.WriteString("\r\n")
	}
	if _, err := conn.Write([]byte(b.String())); err != nil {
		return "", err
	}
	buf := make([]byte, 65536)
	n, err := conn.Read(buf)
	if err != nil {
		return "", err
	}
	return string(buf[:n]), nil
}

func listenRedis(ctx context.Context) {
	addr := os.Getenv("REDIS_ADDR")
	if addr == "" {
		addr = "127.0.0.1:6379"
	}
	conn, err := net.DialTimeout("tcp", addr, 2*time.Second)
	if err != nil {
		log.Printf("pii-redaction: redis intercept disabled (%v)", err)
		return
	}
	defer conn.Close()
	log.Printf("pii-redaction: intercepting Redis list chat:inbound")
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}
		_ = conn.SetDeadline(time.Now().Add(8 * time.Second))
		raw, err := redisCommand(conn, "BRPOP", "chat:inbound", "5")
		if err != nil {
			return
		}
		idx := strings.LastIndex(raw, "{")
		if idx < 0 {
			continue
		}
		var inbound inboundPayload
		if err := json.Unmarshal([]byte(raw[idx:]), &inbound); err != nil {
			continue
		}
		result := Redact(inbound.Content)
		inbound.Content = result.Redacted
		safe, _ := json.Marshal(inbound)
		_, _ = redisCommand(conn, "LPUSH", "chat:broadcast", string(safe))
	}
}

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go listenRedis(ctx)

	mux := http.NewServeMux()
	mux.HandleFunc("/redact", redactHandler)
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	})

	port := os.Getenv("PII_REDACTION_PORT")
	if port == "" {
		port = "8091"
	}
	log.Printf("pii-redaction listening on :%s", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
