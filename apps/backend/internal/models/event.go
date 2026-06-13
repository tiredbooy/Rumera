package models

import (
	"time"

	"github.com/google/uuid"
)

type DeviceType string

const (
	DeviceTypeMobile  DeviceType = "mobile"
	DeviceTypeDesktop DeviceType = "desktop"
	DeviceTypeTablet  DeviceType = "tablet"
	DeviceTypeUnknown DeviceType = "unknown"
)

// ── Entity ────────────────────────────────────────────────────────────────────

type Event struct {
	ID           uuid.UUID      `json:"id"`
	UserID       *uuid.UUID     `json:"user_id"`
	SessionID    uuid.UUID      `json:"session_id"`
	DeviceID     *uuid.UUID     `json:"device_id"`
	EventType    string         `json:"event_type"`
	Payload      map[string]any `json:"payload"`
	PageURL      *string        `json:"page_url"`
	PageReferrer *string        `json:"page_referrer"`
	DeviceType   *DeviceType    `json:"device_type"`
	OS           *string        `json:"os"`
	Browser      *string        `json:"browser"`
	ScreenSize   *string        `json:"screen_size"`
	AppVersion   *string        `json:"app_version"`
	Country      *string        `json:"country"`
	City         *string        `json:"city"`
	Timezone     *string        `json:"timezone"`
	UTMSource    *string        `json:"utm_source"`
	UTMMedium    *string        `json:"utm_medium"`
	UTMCampaign  *string        `json:"utm_campaign"`
	UTMContent   *string        `json:"utm_content"`
	UTMTerm      *string        `json:"utm_term"`
	CreatedAt    time.Time      `json:"created_at"`
}

// ── Request ───────────────────────────────────────────────────────────────────

type EventReq struct {
	UserID       *uuid.UUID     `json:"user_id"`
	SessionID    uuid.UUID      `json:"session_id"`
	DeviceID     *uuid.UUID     `json:"device_id"`
	EventType    string         `json:"event_type"`
	Payload      map[string]any `json:"payload"`
	PageURL      *string        `json:"page_url"`
	PageReferrer *string        `json:"page_referrer"`
	DeviceType   *DeviceType    `json:"device_type"`
	OS           *string        `json:"os"`
	Browser      *string        `json:"browser"`
	ScreenSize   *string        `json:"screen_size"`
	AppVersion   *string        `json:"app_version"`
	Country      *string        `json:"country"`
	City         *string        `json:"city"`
	Timezone     *string        `json:"timezone"`
	UTMSource    *string        `json:"utm_source"`
	UTMMedium    *string        `json:"utm_medium"`
	UTMCampaign  *string        `json:"utm_campaign"`
	UTMContent   *string        `json:"utm_content"`
	UTMTerm      *string        `json:"utm_term"`
}

// ── Query filters ─────────────────────────────────────────────────────────────

type EventFilter struct {
	UserID    *uuid.UUID
	SessionID *uuid.UUID
	EventType *string
	DateFrom  *time.Time
	DateTo    *time.Time
	Country   *string
	Limit     int
	Offset    int
}
