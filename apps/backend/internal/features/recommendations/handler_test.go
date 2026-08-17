package recommendations

import (
	"bytes"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/pkg/validator"
)

func recsHandler(repo *repoStub) *Handler {
	return NewHandler(NewService(repo, nil), validator.New())
}

func postInteraction(t *testing.T, h *Handler, uid int64, body string) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/recommendations/interactions", func(c *gin.Context) {
		c.Set("uid", uid)
		h.RecordInteraction(c)
	})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/recommendations/interactions", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	return w
}

func TestRecordInteractionUnknownProductIs404(t *testing.T) {
	repo := &repoStub{exists: false}
	w := postInteraction(t, recsHandler(repo), 3, `{"product_id":99,"interaction_type":"view"}`)
	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"code":"NOT_FOUND"`) {
		t.Fatalf("body = %s", w.Body.String())
	}
	if repo.recordCalls != 0 {
		t.Fatalf("recordCalls = %d, want 0", repo.recordCalls)
	}
}

func TestRecordInteractionKnownProductIs204(t *testing.T) {
	repo := &repoStub{exists: true, inserted: true}
	w := postInteraction(t, recsHandler(repo), 3, `{"product_id":4,"interaction_type":"add_to_cart"}`)
	if w.Code != http.StatusNoContent {
		t.Fatalf("status = %d body=%s", w.Code, w.Body.String())
	}
	if repo.recordCalls != 1 {
		t.Fatalf("recordCalls = %d, want 1", repo.recordCalls)
	}
}

func TestRecordInteractionProductExistsErrorIs500(t *testing.T) {
	repo := &repoStub{existsErr: errors.New("products down")}
	w := postInteraction(t, recsHandler(repo), 3, `{"product_id":4,"interaction_type":"view"}`)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d body=%s", w.Code, w.Body.String())
	}
	if strings.Contains(w.Body.String(), `"code":"NOT_FOUND"`) {
		t.Fatalf("lookup error must not 404: %s", w.Body.String())
	}
	if repo.recordCalls != 0 {
		t.Fatalf("recordCalls = %d, want 0", repo.recordCalls)
	}
}
