// Package notifications defines versioned notification events, outbox
// enqueue contracts, and pure routing helpers shared by the API and the
// notification-worker process. Kafka transport adapters live under ./kafka.
package notifications

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// CloudEvents-ish types — keep wire format stable; bump suffix on breaking changes.
const (
	TypeOTPV1              = "notification.otp.v1"
	TypePasswordResetV1    = "notification.password_reset.v1"
	TypeOrderConfirmedV1   = "notification.order_confirmed.v1"
	SourceAPI              = "rumera/api"
	TopicOTP               = "rumera.notification.otp.v1"
	TopicEmail             = "rumera.notification.email.v1"
	TopicOTPDLQ            = "rumera.notification.otp.v1.dlq"
	TopicEmailDLQ          = "rumera.notification.email.v1.dlq"
)

// Envelope is the versioned message written to the outbox and Kafka.
type Envelope struct {
	SpecVersion     string          `json:"specversion"`
	ID              string          `json:"id"`
	Type            string          `json:"type"`
	Source          string          `json:"source"`
	Time            time.Time       `json:"time"`
	DataContentType string          `json:"datacontenttype"`
	Data            json.RawMessage `json:"data"`
	Rumera          RumeraMeta      `json:"rumera"`
}

// RumeraMeta carries cross-cutting delivery fields.
type RumeraMeta struct {
	CorrelationID  string `json:"correlation_id,omitempty"`
	IdempotencyKey string `json:"idempotency_key"`
	Attempt        int    `json:"attempt"`
}

// OTPData is the payload for TypeOTPV1.
type OTPData struct {
	Phone   string `json:"phone"`
	Code    string `json:"code"`
	Purpose string `json:"purpose"`
}

// EmailData is a generic email template payload.
type EmailData struct {
	To       string         `json:"to"`
	Subject  string         `json:"subject"`
	Template string         `json:"template"`
	Vars     map[string]any `json:"vars,omitempty"`
}

// NewEnvelope builds a validated envelope with a fresh message id.
func NewEnvelope(eventType, idempotencyKey, correlationID string, data any) (*Envelope, error) {
	if eventType == "" || idempotencyKey == "" {
		return nil, fmt.Errorf("notifications: type and idempotency_key are required")
	}
	raw, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("notifications: marshal data: %w", err)
	}
	return &Envelope{
		SpecVersion:     "1.0",
		ID:              uuid.NewString(),
		Type:            eventType,
		Source:          SourceAPI,
		Time:            time.Now().UTC(),
		DataContentType: "application/json",
		Data:            raw,
		Rumera: RumeraMeta{
			CorrelationID:  correlationID,
			IdempotencyKey: idempotencyKey,
			Attempt:        1,
		},
	}, nil
}

// TopicForEvent maps event type → Kafka topic.
func TopicForEvent(eventType string) (string, error) {
	switch eventType {
	case TypeOTPV1:
		return TopicOTP, nil
	case TypePasswordResetV1, TypeOrderConfirmedV1:
		return TopicEmail, nil
	default:
		return "", fmt.Errorf("notifications: unknown event type %q", eventType)
	}
}

// DLQTopic returns the dead-letter topic for a main topic.
func DLQTopic(topic string) string {
	switch topic {
	case TopicOTP:
		return TopicOTPDLQ
	case TopicEmail:
		return TopicEmailDLQ
	default:
		return topic + ".dlq"
	}
}

// PartitionKey chooses the Kafka key for ordering.
func PartitionKey(eventType string, data json.RawMessage) string {
	switch eventType {
	case TypeOTPV1:
		var d OTPData
		if json.Unmarshal(data, &d) == nil && d.Phone != "" {
			return d.Phone
		}
	case TypePasswordResetV1, TypeOrderConfirmedV1:
		var d EmailData
		if json.Unmarshal(data, &d) == nil && d.To != "" {
			return d.To
		}
	}
	return "default"
}

// ChannelForEvent returns the delivery channel label for metrics/ledger.
func ChannelForEvent(eventType string) string {
	switch eventType {
	case TypeOTPV1:
		return "sms"
	default:
		return "email"
	}
}
