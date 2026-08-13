package analytics

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type EventRepository interface {
	Insert(ctx context.Context, req *EventReq) error
	InsertBatch(ctx context.Context, reqs []*EventReq) error
	GetByID(ctx context.Context, id string) (*Event, error)
	List(ctx context.Context, filter EventFilter) ([]*Event, error)
	CountByType(ctx context.Context, filter EventFilter) (EventBreakdown, error)
}

type eventRepository struct{ db *pgxpool.Pool }

func NewEventRepository(db *pgxpool.Pool) EventRepository {
	return &eventRepository{db: db}
}

const eventInsertQuery = `
	INSERT INTO events (
		user_id, session_id, device_id, event_type, payload,
		page_url, page_referrer, device_type, os, browser,
		screen_size, app_version, country, city, timezone,
		utm_source, utm_medium, utm_campaign, utm_content, utm_term
	) VALUES (
		$1,$2,$3,$4,$5,
		$6,$7,$8,$9,$10,
		$11,$12,$13,$14,$15,
		$16,$17,$18,$19,$20
	)`

func (r *eventRepository) Insert(ctx context.Context, req *EventReq) error {
	_, err := r.db.Exec(ctx, eventInsertQuery,
		req.UserID, req.SessionID, req.DeviceID, req.EventType, req.Payload,
		req.PageURL, req.PageReferrer, req.DeviceType, req.OS, req.Browser,
		req.ScreenSize, req.AppVersion, req.Country, req.City, req.Timezone,
		req.UTMSource, req.UTMMedium, req.UTMCampaign, req.UTMContent, req.UTMTerm,
	)
	if err != nil {
		return fmt.Errorf("inserting event: %w", err)
	}
	return nil
}

// InsertBatch sends all events in a single round-trip via pgx.Batch.
// This is the hot path — call it from a background worker that drains
// an in-memory channel, not on every HTTP request directly.
func (r *eventRepository) InsertBatch(ctx context.Context, reqs []*EventReq) error {
	if len(reqs) == 0 {
		return nil
	}

	batch := &pgx.Batch{}
	for _, req := range reqs {
		batch.Queue(eventInsertQuery,
			req.UserID, req.SessionID, req.DeviceID, req.EventType, req.Payload,
			req.PageURL, req.PageReferrer, req.DeviceType, req.OS, req.Browser,
			req.ScreenSize, req.AppVersion, req.Country, req.City, req.Timezone,
			req.UTMSource, req.UTMMedium, req.UTMCampaign, req.UTMContent, req.UTMTerm,
		)
	}

	br := r.db.SendBatch(ctx, batch)
	defer br.Close()

	for range reqs {
		if _, err := br.Exec(); err != nil {
			return fmt.Errorf("batch inserting event: %w", err)
		}
	}
	return nil
}

func (r *eventRepository) GetByID(ctx context.Context, id string) (*Event, error) {
	query := `
		SELECT id, user_id, session_id, device_id, event_type, payload,
		       page_url, page_referrer, device_type, os, browser,
		       screen_size, app_version, country, city, timezone,
		       utm_source, utm_medium, utm_campaign, utm_content, utm_term,
		       created_at
		FROM events WHERE id = $1`

	e := &Event{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&e.ID, &e.UserID, &e.SessionID, &e.DeviceID, &e.EventType, &e.Payload,
		&e.PageURL, &e.PageReferrer, &e.DeviceType, &e.OS, &e.Browser,
		&e.ScreenSize, &e.AppVersion, &e.Country, &e.City, &e.Timezone,
		&e.UTMSource, &e.UTMMedium, &e.UTMCampaign, &e.UTMContent, &e.UTMTerm,
		&e.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("getting event: %w", err)
	}
	return e, nil
}

// List applies filters dynamically. Keep it read-only and paginated —
// events table will grow to hundreds of millions of rows.
func (r *eventRepository) List(ctx context.Context, filter EventFilter) ([]*Event, error) {
	query := `
		SELECT id, user_id, session_id, device_id, event_type, payload,
		       page_url, page_referrer, device_type, os, browser,
		       screen_size, app_version, country, city, timezone,
		       utm_source, utm_medium, utm_campaign, utm_content, utm_term,
		       created_at
		FROM events
		WHERE ($1::uuid IS NULL OR user_id    = $1)
		  AND ($2::uuid IS NULL OR session_id  = $2)
		  AND ($3::text IS NULL OR event_type  = $3)
		  AND ($4::timestamptz IS NULL OR created_at >= $4)
		  AND ($5::timestamptz IS NULL OR created_at <= $5)
		  AND ($6::text IS NULL OR country    = $6)
		ORDER BY created_at DESC
		LIMIT $7 OFFSET $8`

	limit := filter.Limit
	if limit == 0 {
		limit = 50
	}

	rows, err := r.db.Query(ctx, query,
		filter.UserID, filter.SessionID, filter.EventType,
		filter.DateFrom, filter.DateTo, filter.Country,
		limit, filter.Offset,
	)
	if err != nil {
		return nil, fmt.Errorf("listing events: %w", err)
	}
	defer rows.Close()

	var events []*Event
	for rows.Next() {
		e := &Event{}
		if err := rows.Scan(
			&e.ID, &e.UserID, &e.SessionID, &e.DeviceID, &e.EventType, &e.Payload,
			&e.PageURL, &e.PageReferrer, &e.DeviceType, &e.OS, &e.Browser,
			&e.ScreenSize, &e.AppVersion, &e.Country, &e.City, &e.Timezone,
			&e.UTMSource, &e.UTMMedium, &e.UTMCampaign, &e.UTMContent, &e.UTMTerm,
			&e.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning event: %w", err)
		}
		events = append(events, e)
	}
	return events, rows.Err()
}

func (r *eventRepository) CountByType(ctx context.Context, filter EventFilter) (EventBreakdown, error) {
	query := `
		SELECT event_type, COUNT(*) 
		FROM events
		WHERE ($1::timestamptz IS NULL OR created_at >= $1)
		  AND ($2::timestamptz IS NULL OR created_at <= $2)
		  AND ($3::text IS NULL OR country = $3)
		GROUP BY event_type`

	rows, err := r.db.Query(ctx, query, filter.DateFrom, filter.DateTo, filter.Country)
	if err != nil {
		return nil, fmt.Errorf("counting events by type: %w", err)
	}
	defer rows.Close()

	counts := make(EventBreakdown)
	for rows.Next() {
		var eventType string
		var count int64
		if err := rows.Scan(&eventType, &count); err != nil {
			return nil, fmt.Errorf("scanning event count: %w", err)
		}
		counts[eventType] = count
	}
	return counts, rows.Err()
}
