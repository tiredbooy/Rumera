// Package notify provides a small transport-agnostic mailer used to deliver
// transactional email (password resets, order confirmations). It ships an SMTP
// implementation and a no-op fallback so the app runs locally without an SMTP
// server configured.
package notify

import (
	"context"
	"fmt"
	"net/smtp"
	"strings"

	config "github.com/tiredbooy/configs"
	"go.uber.org/zap"
)

// Mailer sends a single HTML email. Implementations must be safe for concurrent
// use — callers typically invoke Send from a goroutine so the request path is
// never blocked on the mail server.
type Mailer interface {
	Send(ctx context.Context, to, subject, htmlBody string) error
}

// New returns an SMTP-backed mailer when SMTP_HOST is configured, otherwise a
// no-op mailer that logs what it would have sent. This keeps local development
// and tests free of a hard SMTP dependency.
func New(cfg *config.Config, log *zap.Logger) Mailer {
	if cfg.SMTPHost == "" {
		log.Info("notify: SMTP not configured, using no-op mailer")
		return &noopMailer{log: log}
	}
	return &smtpMailer{
		addr: fmt.Sprintf("%s:%d", cfg.SMTPHost, cfg.SMTPPort),
		auth: smtp.PlainAuth("", cfg.SMTPUser, cfg.SMTPPassword, cfg.SMTPHost),
		from: cfg.SMTPFrom,
		log:  log,
	}
}

// ── SMTP implementation ────────────────────────────────────────────────────

type smtpMailer struct {
	addr string
	auth smtp.Auth
	from string
	log  *zap.Logger
}

func (m *smtpMailer) Send(ctx context.Context, to, subject, htmlBody string) error {
	msg := buildMIME(m.from, to, subject, htmlBody)
	if err := smtp.SendMail(m.addr, m.auth, m.from, []string{to}, msg); err != nil {
		m.log.Warn("notify: send failed", zap.String("to", to), zap.Error(err))
		return fmt.Errorf("notify send: %w", err)
	}
	return nil
}

// buildMIME assembles a minimal RFC 822 / MIME HTML message.
func buildMIME(from, to, subject, htmlBody string) []byte {
	var b strings.Builder
	b.WriteString("From: " + from + "\r\n")
	b.WriteString("To: " + to + "\r\n")
	b.WriteString("Subject: " + subject + "\r\n")
	b.WriteString("MIME-Version: 1.0\r\n")
	b.WriteString("Content-Type: text/html; charset=\"UTF-8\"\r\n")
	b.WriteString("\r\n")
	b.WriteString(htmlBody)
	return []byte(b.String())
}

// ── No-op implementation ───────────────────────────────────────────────────

type noopMailer struct {
	log *zap.Logger
}

func (m *noopMailer) Send(_ context.Context, to, subject, _ string) error {
	m.log.Info("notify: (noop) email suppressed",
		zap.String("to", to), zap.String("subject", subject))
	return nil
}
