package models

import (
	"encoding/json"
	"testing"
	"time"
)

func TestTagJSONContractIncludesSlugAndSnakeCaseTimestamps(t *testing.T) {
	now := time.Date(2026, time.July, 19, 12, 0, 0, 0, time.UTC)
	tag := Tag{
		ID:        7,
		Title:     "ممتاز",
		Slug:      "ممتاز",
		CreatedAt: now,
		UpdatedAt: now,
	}

	data, err := json.Marshal(tag)
	if err != nil {
		t.Fatalf("marshal tag: %v", err)
	}

	var got map[string]any
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("decode tag: %v", err)
	}
	for _, key := range []string{"id", "title", "slug", "created_at", "updated_at"} {
		if _, ok := got[key]; !ok {
			t.Fatalf("response missing %q: %s", key, data)
		}
	}
	if _, ok := got["description"]; ok {
		t.Fatalf("nil description must be omitted: %s", data)
	}
}

func TestUpdateTagReqDistinguishesNullDescriptionFromOmission(t *testing.T) {
	var clearReq UpdateTagReq
	if err := json.Unmarshal([]byte(`{"description":null}`), &clearReq); err != nil {
		t.Fatalf("decode explicit null: %v", err)
	}
	if !clearReq.Description.Set || clearReq.Description.Value != nil {
		t.Fatalf("description patch = %+v; want explicit null", clearReq.Description)
	}

	var omittedReq UpdateTagReq
	if err := json.Unmarshal([]byte(`{"title":"new"}`), &omittedReq); err != nil {
		t.Fatalf("decode omission: %v", err)
	}
	if omittedReq.Description.Set {
		t.Fatal("omitted description must remain unset")
	}
}
