// Package meili is a thin HTTP client for Meilisearch product-index operations.
//
// PH-030b readiness only: the storefront still queries Postgres ILIKE
// (see architecture/search.md). Enable with MEILI_ENABLED=true; when disabled
// or unreachable at boot, the API continues and the reindex cron is skipped.
package meili

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"go.uber.org/zap"
)

const (
	defaultTimeout   = 15 * time.Second
	taskPollInterval = 200 * time.Millisecond
	taskWaitTimeout  = 2 * time.Minute
)

// Client talks to one Meilisearch host and one products index.
type Client struct {
	host     string
	apiKey   string
	indexUID string
	http     *http.Client
	log      *zap.Logger
}

// New pings Meili and returns a client. Callers should treat connection
// failure as optional infrastructure (like Redis), not a boot-fatal error.
func New(host, apiKey, indexUID string, log *zap.Logger) (*Client, error) {
	host = strings.TrimRight(strings.TrimSpace(host), "/")
	if host == "" {
		return nil, fmt.Errorf("meili: empty host")
	}
	if indexUID == "" {
		indexUID = "products"
	}
	if log == nil {
		log = zap.NewNop()
	}
	c := &Client{
		host:     host,
		apiKey:   apiKey,
		indexUID: indexUID,
		http:     &http.Client{Timeout: defaultTimeout},
		log:      log,
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := c.Health(ctx); err != nil {
		return nil, err
	}
	log.Info("meilisearch connected", zap.String("host", host), zap.String("index", indexUID))
	return c, nil
}

// IndexUID returns the configured products index name.
func (c *Client) IndexUID() string { return c.indexUID }

// Health checks GET /health.
func (c *Client) Health(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.host+"/health", nil)
	if err != nil {
		return err
	}
	res, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("meili health: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(res.Body, 512))
		return fmt.Errorf("meili health: status %d: %s", res.StatusCode, bytes.TrimSpace(body))
	}
	return nil
}

// EnsureProductsIndex creates the index (if missing) and applies settings for
// Persian-aware product search documents (searchable/filterable/sortable).
func (c *Client) EnsureProductsIndex(ctx context.Context) error {
	// Create index — 201 created, 202 accepted task, or 409 already exists.
	createBody := map[string]string{
		"uid":        c.indexUID,
		"primaryKey": "id",
	}
	status, _, err := c.doJSON(ctx, http.MethodPost, c.host+"/indexes", createBody)
	if err != nil {
		return fmt.Errorf("meili create index: %w", err)
	}
	if status == http.StatusAccepted || status == http.StatusCreated {
		// task enqueued or created — wait if task uid present is handled below via settings
	} else if status != http.StatusConflict && status != http.StatusOK {
		return fmt.Errorf("meili create index: unexpected status %d", status)
	}

	settings := map[string]any{
		// Prefer normalized *_search fields (PH-030a parity), then display text.
		"searchableAttributes": []string{
			"title_search",
			"description_search",
			"brand_search",
			"category_search",
			"tags",
			"code",
			"title",
			"description",
			"brand_title",
			"category_title",
		},
		"filterableAttributes": []string{
			"is_active",
			"brand_id",
			"category_id",
			"min_price",
			"max_price",
			"country_of_origin",
		},
		"sortableAttributes": []string{
			"min_price",
			"max_price",
			"title",
			"id",
		},
		"displayedAttributes": []string{
			"id", "title", "code", "slug", "description",
			"brand_id", "brand_title", "category_id", "category_title",
			"tags", "meta_tags", "min_price", "max_price",
			"is_active", "country_of_origin",
			// Keep search fields out of default display noise but Meili still stores them.
			"title_search", "description_search", "brand_search", "category_search",
		},
	}
	path := fmt.Sprintf("%s/indexes/%s/settings", c.host, c.indexUID)
	status, raw, err := c.doJSON(ctx, http.MethodPatch, path, settings)
	if err != nil {
		return fmt.Errorf("meili settings: %w", err)
	}
	if status != http.StatusAccepted && status != http.StatusOK {
		return fmt.Errorf("meili settings: status %d: %s", status, raw)
	}
	if err := c.waitTaskFromBody(ctx, raw); err != nil {
		return fmt.Errorf("meili settings task: %w", err)
	}
	return nil
}

// DeleteAllDocuments clears the products index (used before full rebuild).
func (c *Client) DeleteAllDocuments(ctx context.Context) error {
	path := fmt.Sprintf("%s/indexes/%s/documents", c.host, c.indexUID)
	status, raw, err := c.doJSON(ctx, http.MethodDelete, path, nil)
	if err != nil {
		return fmt.Errorf("meili delete all: %w", err)
	}
	if status != http.StatusAccepted && status != http.StatusOK {
		return fmt.Errorf("meili delete all: status %d: %s", status, raw)
	}
	return c.waitTaskFromBody(ctx, raw)
}

// UpsertDocuments adds or updates documents by primary key `id`.
// docs must be a JSON-marshalable slice of objects.
func (c *Client) UpsertDocuments(ctx context.Context, docs any) error {
	path := fmt.Sprintf("%s/indexes/%s/documents?primaryKey=id", c.host, c.indexUID)
	status, raw, err := c.doJSON(ctx, http.MethodPost, path, docs)
	if err != nil {
		return fmt.Errorf("meili upsert: %w", err)
	}
	if status != http.StatusAccepted && status != http.StatusOK {
		return fmt.Errorf("meili upsert: status %d: %s", status, raw)
	}
	return c.waitTaskFromBody(ctx, raw)
}

// DeleteDocument removes one product document by id.
func (c *Client) DeleteDocument(ctx context.Context, id int64) error {
	path := fmt.Sprintf("%s/indexes/%s/documents/%d", c.host, c.indexUID, id)
	status, raw, err := c.doJSON(ctx, http.MethodDelete, path, nil)
	if err != nil {
		return fmt.Errorf("meili delete doc: %w", err)
	}
	if status == http.StatusNotFound {
		return nil
	}
	if status != http.StatusAccepted && status != http.StatusOK {
		return fmt.Errorf("meili delete doc: status %d: %s", status, raw)
	}
	return c.waitTaskFromBody(ctx, raw)
}

// SearchRequest is a minimal product search (for dual-path experiments / tests).
// Not exposed on public HTTP routes in PH-030b.
type SearchRequest struct {
	Query  string `json:"q"`
	Filter string `json:"filter,omitempty"`
	Limit  int    `json:"limit,omitempty"`
	Offset int    `json:"offset,omitempty"`
}

// SearchResponse is a trimmed Meili search reply (ids via Hits).
type SearchResponse struct {
	Hits               []json.RawMessage `json:"hits"`
	EstimatedTotalHits int               `json:"estimatedTotalHits"`
	ProcessingTimeMs   int               `json:"processingTimeMs"`
	Query              string            `json:"query"`
}

// Search runs POST /indexes/{uid}/search. Callers must not treat results as
// inventory truth — hydrate prices/stock from Postgres on cutover.
func (c *Client) Search(ctx context.Context, req SearchRequest) (*SearchResponse, error) {
	if req.Limit <= 0 {
		req.Limit = 24
	}
	path := fmt.Sprintf("%s/indexes/%s/search", c.host, c.indexUID)
	status, raw, err := c.doJSON(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, fmt.Errorf("meili search: %w", err)
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("meili search: status %d: %s", status, raw)
	}
	var out SearchResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, fmt.Errorf("meili search decode: %w", err)
	}
	return &out, nil
}

func (c *Client) doJSON(ctx context.Context, method, url string, body any) (int, []byte, error) {
	var rdr io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return 0, nil, err
		}
		rdr = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, url, rdr)
	if err != nil {
		return 0, nil, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}
	res, err := c.http.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(res.Body, 4<<20))
	if err != nil {
		return res.StatusCode, nil, err
	}
	return res.StatusCode, raw, nil
}

type taskEnqueued struct {
	TaskUID int64  `json:"taskUid"`
	Status  string `json:"status"`
}

func (c *Client) waitTaskFromBody(ctx context.Context, raw []byte) error {
	if len(raw) == 0 {
		return nil
	}
	var t taskEnqueued
	if err := json.Unmarshal(raw, &t); err != nil || t.TaskUID == 0 {
		// Some endpoints return the resource directly (no task).
		return nil
	}
	return c.waitTask(ctx, t.TaskUID)
}

func (c *Client) waitTask(ctx context.Context, taskUID int64) error {
	deadline := time.Now().Add(taskWaitTimeout)
	if d, ok := ctx.Deadline(); ok && d.Before(deadline) {
		deadline = d
	}
	path := fmt.Sprintf("%s/tasks/%d", c.host, taskUID)
	for {
		if time.Now().After(deadline) {
			return fmt.Errorf("meili task %d: wait timeout", taskUID)
		}
		status, raw, err := c.doJSON(ctx, http.MethodGet, path, nil)
		if err != nil {
			return err
		}
		if status != http.StatusOK {
			return fmt.Errorf("meili task %d: status %d: %s", taskUID, status, raw)
		}
		var body struct {
			Status string `json:"status"`
			Error  *struct {
				Message string `json:"message"`
				Code    string `json:"code"`
			} `json:"error"`
		}
		if err := json.Unmarshal(raw, &body); err != nil {
			return err
		}
		switch body.Status {
		case "succeeded":
			return nil
		case "failed", "canceled":
			msg := body.Status
			if body.Error != nil && body.Error.Message != "" {
				msg = body.Error.Message
			}
			return fmt.Errorf("meili task %d: %s", taskUID, msg)
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(taskPollInterval):
		}
	}
}
