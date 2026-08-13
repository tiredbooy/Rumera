package media

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/pkg/imaging"
	"go.uber.org/zap"
)

func TestReadImageUploadAllowsFramingButRejectsOversizedFile(t *testing.T) {
	const maxBytes = int64(1024)
	h := NewHandler(
		NewService(
			nil, nil, nil, nil, nil, nil, imaging.New(),
			Config{MaxUploadBytes: maxBytes}, zap.NewNop(),
		),
		nil,
		nil,
	)

	t.Run("file exactly at limit", func(t *testing.T) {
		data := bytes.Repeat([]byte{'a'}, int(maxBytes))
		ctx, recorder := multipartUploadContext(t, data)
		got, ok := h.readImageUpload(ctx)
		if !ok || !bytes.Equal(got, data) {
			t.Fatalf("readImageUpload = %d bytes, %v; want %d bytes, true", len(got), ok, len(data))
		}
		if recorder.Code != http.StatusOK {
			t.Fatalf("status = %d; want %d", recorder.Code, http.StatusOK)
		}
	})

	t.Run("file one byte over limit", func(t *testing.T) {
		ctx, recorder := multipartUploadContext(t, bytes.Repeat([]byte{'a'}, int(maxBytes+1)))
		if data, ok := h.readImageUpload(ctx); ok || data != nil {
			t.Fatalf("readImageUpload = %d bytes, %v; want nil, false", len(data), ok)
		}
		if recorder.Code != http.StatusRequestEntityTooLarge {
			t.Fatalf("status = %d; want %d", recorder.Code, http.StatusRequestEntityTooLarge)
		}
	})

	t.Run("request beyond framing allowance", func(t *testing.T) {
		size := maxBytes + mediaMultipartOverheadBytes + 1
		ctx, recorder := multipartUploadContext(t, bytes.Repeat([]byte{'a'}, int(size)))
		if data, ok := h.readImageUpload(ctx); ok || data != nil {
			t.Fatalf("readImageUpload = %d bytes, %v; want nil, false", len(data), ok)
		}
		if recorder.Code != http.StatusRequestEntityTooLarge {
			t.Fatalf("status = %d; want %d", recorder.Code, http.StatusRequestEntityTooLarge)
		}
	})
}

func multipartUploadContext(t *testing.T, data []byte) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "image.png")
	if err != nil {
		t.Fatalf("create multipart file: %v", err)
	}
	if _, err := part.Write(data); err != nil {
		t.Fatalf("write multipart file: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart body: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	request := httptest.NewRequest(http.MethodPost, "/upload", &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	ctx.Request = request
	return ctx, recorder
}
