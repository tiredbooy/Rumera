package meili

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"go.uber.org/zap"
)

func TestClientHealthAndEnsureAndUpsert(t *testing.T) {
	var taskID atomic.Int64
	taskID.Store(1)

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"available"}`))
	})
	mux.HandleFunc("/indexes", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("indexes method %s", r.Method)
		}
		w.WriteHeader(http.StatusConflict) // already exists
	})
	mux.HandleFunc("/indexes/products/settings", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPatch {
			t.Fatalf("settings method %s", r.Method)
		}
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		searchable, _ := body["searchableAttributes"].([]any)
		if len(searchable) == 0 {
			t.Fatal("missing searchableAttributes")
		}
		id := taskID.Add(1)
		w.WriteHeader(http.StatusAccepted)
		_ = json.NewEncoder(w).Encode(map[string]any{"taskUid": id, "status": "enqueued"})
	})
	mux.HandleFunc("/indexes/products/documents", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodDelete:
			id := taskID.Add(1)
			w.WriteHeader(http.StatusAccepted)
			_ = json.NewEncoder(w).Encode(map[string]any{"taskUid": id})
		case http.MethodPost:
			var docs []map[string]any
			if err := json.NewDecoder(r.Body).Decode(&docs); err != nil {
				t.Fatal(err)
			}
			if len(docs) != 1 || docs[0]["id"] == nil {
				t.Fatalf("docs = %#v", docs)
			}
			id := taskID.Add(1)
			w.WriteHeader(http.StatusAccepted)
			_ = json.NewEncoder(w).Encode(map[string]any{"taskUid": id})
		default:
			t.Fatalf("documents method %s", r.Method)
		}
	})
	mux.HandleFunc("/tasks/", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"status": "succeeded", "uid": 1})
	})

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	c, err := New(srv.URL, "test-key", "products", zap.NewNop())
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := c.EnsureProductsIndex(ctx); err != nil {
		t.Fatalf("EnsureProductsIndex: %v", err)
	}
	if err := c.DeleteAllDocuments(ctx); err != nil {
		t.Fatalf("DeleteAllDocuments: %v", err)
	}
	docs := []map[string]any{{"id": 1, "title": "Test", "title_search": "test"}}
	if err := c.UpsertDocuments(ctx, docs); err != nil {
		t.Fatalf("UpsertDocuments: %v", err)
	}
}

func TestClientSearch(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mux.HandleFunc("/indexes/products/search", func(w http.ResponseWriter, r *http.Request) {
		var req SearchRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatal(err)
		}
		if req.Query != "whisky" {
			t.Fatalf("q = %q", req.Query)
		}
		_ = json.NewEncoder(w).Encode(SearchResponse{
			Hits:               []json.RawMessage{[]byte(`{"id":9}`)},
			EstimatedTotalHits: 1,
			Query:              req.Query,
		})
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	c, err := New(srv.URL, "", "products", zap.NewNop())
	if err != nil {
		t.Fatal(err)
	}
	out, err := c.Search(context.Background(), SearchRequest{Query: "whisky"})
	if err != nil {
		t.Fatal(err)
	}
	if out.EstimatedTotalHits != 1 || len(out.Hits) != 1 {
		t.Fatalf("search = %+v", out)
	}
}

func TestNewRejectsEmptyHost(t *testing.T) {
	if _, err := New("  ", "", "products", zap.NewNop()); err == nil {
		t.Fatal("expected error for empty host")
	}
}
