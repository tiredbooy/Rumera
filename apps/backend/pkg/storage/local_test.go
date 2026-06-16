package storage

import (
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLocalStorage_RoundTrip(t *testing.T) {
	s, err := NewLocalStorage(t.TempDir())
	if err != nil {
		t.Fatalf("new: %v", err)
	}
	ctx := context.Background()

	const key = "products/abc123.webp"
	want := []byte("hello-image-bytes")
	if err := s.Put(ctx, key, bytes.NewReader(want)); err != nil {
		t.Fatalf("put: %v", err)
	}

	ok, err := s.Exists(ctx, key)
	if err != nil || !ok {
		t.Fatalf("exists = %v, %v; want true, nil", ok, err)
	}

	rc, err := s.Open(ctx, key)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	got, _ := io.ReadAll(rc)
	rc.Close()
	if !bytes.Equal(got, want) {
		t.Fatalf("read = %q; want %q", got, want)
	}

	if err := s.Delete(ctx, key); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if ok, _ := s.Exists(ctx, key); ok {
		t.Fatalf("exists after delete = true; want false")
	}
	// Deleting an absent key is not an error.
	if err := s.Delete(ctx, key); err != nil {
		t.Fatalf("delete absent: %v", err)
	}
}

func TestLocalStorage_OpenMissing(t *testing.T) {
	s, _ := NewLocalStorage(t.TempDir())
	_, err := s.Open(context.Background(), "nope/missing.jpg")
	if !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("open missing err = %v; want os.ErrNotExist", err)
	}
}

func TestLocalStorage_RejectsTraversal(t *testing.T) {
	root := t.TempDir()
	s, _ := NewLocalStorage(root)
	ctx := context.Background()

	// Plant a secret file as a sibling of the storage root.
	secret := filepath.Join(filepath.Dir(root), "secret.txt")
	if err := os.WriteFile(secret, []byte("top-secret"), 0o600); err != nil {
		t.Fatalf("seed secret: %v", err)
	}

	traversals := []string{
		"../secret.txt",
		"../../secret.txt",
		"products/../../secret.txt",
		"/etc/passwd",
		"",
		".",
	}
	for _, key := range traversals {
		t.Run(key, func(t *testing.T) {
			if err := s.Put(ctx, key, strings.NewReader("x")); err == nil {
				t.Fatalf("Put(%q) succeeded; want rejection", key)
			}
			if _, err := s.Open(ctx, key); err == nil {
				t.Fatalf("Open(%q) succeeded; want rejection", key)
			}
		})
	}

	// The secret must be untouched and nothing should have escaped the root.
	if b, _ := os.ReadFile(secret); string(b) != "top-secret" {
		t.Fatalf("secret was modified: %q", b)
	}
}
