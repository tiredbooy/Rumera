// Package sms provides a small transport-agnostic SMS sender used for OTP login
// and transactional alerts. It ships a Kavenegar (Iranian provider) HTTP
// implementation and a no-op/log fallback so the app runs locally without an SMS
// account configured.
package sms

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"time"

	config "github.com/tiredbooy/configs"
	"go.uber.org/zap"
)

// Sender delivers a single SMS. Implementations must be safe for concurrent use;
// callers typically invoke Send from a goroutine so the request path is never
// blocked on the SMS gateway.
type Sender interface {
	Send(ctx context.Context, to, message string) error
}

// New returns a provider-backed sender when one is configured, otherwise a no-op
// sender that logs what it would have sent (handy in dev — the OTP shows up in
// the logs). Selection is driven by SMS_PROVIDER + SMS_API_KEY.
func New(cfg *config.Config, log *zap.Logger) Sender {
	switch cfg.SMSProvider {
	case "kavenegar":
		if cfg.SMSAPIKey == "" {
			log.Warn("sms: kavenegar selected but SMS_API_KEY empty, using log sender")
			return &logSender{log: log}
		}
		return &kavenegarSender{
			apiKey: cfg.SMSAPIKey,
			sender: cfg.SMSSender,
			log:    log,
			http:   &http.Client{Timeout: 8 * time.Second},
		}
	default:
		log.Info("sms: no provider configured, using log sender")
		return &logSender{log: log}
	}
}

// ── log / no-op implementation ──────────────────────────────────────────────

type logSender struct{ log *zap.Logger }

func (s *logSender) Send(_ context.Context, to, message string) error {
	// Intentionally logs the message so OTP codes are visible during local dev.
	s.log.Info("sms (log sender)", zap.String("to", to), zap.String("message", message))
	return nil
}

// ── Kavenegar implementation ────────────────────────────────────────────────
// Simple REST call: GET https://api.kavenegar.com/v1/{KEY}/sms/send.json

type kavenegarSender struct {
	apiKey string
	sender string
	log    *zap.Logger
	http   *http.Client
}

func (s *kavenegarSender) Send(ctx context.Context, to, message string) error {
	endpoint := fmt.Sprintf("https://api.kavenegar.com/v1/%s/sms/send.json", url.PathEscape(s.apiKey))

	q := url.Values{}
	q.Set("receptor", to)
	q.Set("message", message)
	if s.sender != "" {
		q.Set("sender", s.sender)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, nil)
	if err != nil {
		return fmt.Errorf("sms.kavenegar build request: %w", err)
	}
	req.URL.RawQuery = q.Encode()

	res, err := s.http.Do(req)
	if err != nil {
		return fmt.Errorf("sms.kavenegar send: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode/100 != 2 {
		return fmt.Errorf("sms.kavenegar: unexpected status %d", res.StatusCode)
	}
	return nil
}
