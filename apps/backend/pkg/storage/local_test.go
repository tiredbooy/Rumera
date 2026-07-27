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

func TestLocalStorage_RoundTripLegacyAndNestedKeys(t *testing.T) {
	s, err := NewLocalStorage(t.TempDir())
	if err != nil {
		t.Fatalf("new: %v", err)
	}
	ctx := context.Background()

	tests := []struct {
		name string
		key  string
	}{
		{name: "legacy flat", key: "products/550e8400-e29b-41d4-a716-446655440000.webp"},
		{name: "nested owner", key: "products/42-stable-product/originals/550e8400-e29b-41d4-a716-446655440000.webp"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			want := []byte("hello-" + tt.name)
			if err := s.Put(ctx, tt.key, bytes.NewReader(want)); err != nil {
				t.Fatalf("put: %v", err)
			}

			ok, err := s.Exists(ctx, tt.key)
			if err != nil || !ok {
				t.Fatalf("exists = %v, %v; want true, nil", ok, err)
			}
			if got := readObject(t, s, tt.key); !bytes.Equal(got, want) {
				t.Fatalf("read = %q; want %q", got, want)
			}

			if err := s.Delete(ctx, tt.key); err != nil {
				t.Fatalf("delete: %v", err)
			}
			if ok, err := s.Exists(ctx, tt.key); err != nil || ok {
				t.Fatalf("exists after delete = %v, %v; want false, nil", ok, err)
			}
			if err := s.Delete(ctx, tt.key); err != nil {
				t.Fatalf("delete absent: %v", err)
			}
		})
	}
}

func TestLocalStorage_OpenMissing(t *testing.T) {
	s, err := NewLocalStorage(t.TempDir())
	if err != nil {
		t.Fatalf("new: %v", err)
	}
	_, err = s.Open(context.Background(), "nope/missing.jpg")
	if !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("open missing err = %v; want os.ErrNotExist", err)
	}
}

func TestLocalStorage_ListAndDeletePrefix(t *testing.T) {
	s, err := NewLocalStorage(t.TempDir())
	if err != nil {
		t.Fatalf("new: %v", err)
	}
	ctx := context.Background()
	for key, value := range map[string]string{
		"render-v2/aa/source/one.webp": "one",
		"render-v2/aa/source/two.webp": "two",
		"render-v2/bb/other/one.webp":  "other",
		"products/1/image.webp":        "original",
	} {
		if err := s.Put(ctx, key, strings.NewReader(value)); err != nil {
			t.Fatalf("put %q: %v", key, err)
		}
	}

	objects, err := s.List(ctx, "render-v2/aa/source")
	if err != nil {
		t.Fatalf("list prefix: %v", err)
	}
	if len(objects) != 2 || objects[0].Key != "render-v2/aa/source/one.webp" || objects[1].Key != "render-v2/aa/source/two.webp" {
		t.Fatalf("listed objects = %+v", objects)
	}
	if objects[0].Size != 3 || objects[0].ModTime.IsZero() {
		t.Fatalf("listed metadata = %+v", objects[0])
	}

	if err := s.DeletePrefix(ctx, "render-v2/aa/source"); err != nil {
		t.Fatalf("delete prefix: %v", err)
	}
	remaining, err := s.List(ctx, "")
	if err != nil {
		t.Fatalf("list all: %v", err)
	}
	if len(remaining) != 2 || remaining[0].Key != "products/1/image.webp" || remaining[1].Key != "render-v2/bb/other/one.webp" {
		t.Fatalf("remaining objects = %+v", remaining)
	}
	if err := s.DeletePrefix(ctx, "render-v2/aa/source"); err != nil {
		t.Fatalf("delete missing prefix: %v", err)
	}
}

func TestLocalStorage_ListRejectsSymlink(t *testing.T) {
	root := t.TempDir()
	s, err := NewLocalStorage(root)
	if err != nil {
		t.Fatalf("new: %v", err)
	}
	if err := os.MkdirAll(filepath.Join(root, "render-v2"), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.Symlink(t.TempDir(), filepath.Join(root, "render-v2", "escape")); err != nil {
		t.Skipf("symlinks unavailable: %v", err)
	}

	if _, err := s.List(context.Background(), "render-v2"); !errors.Is(err, ErrInvalidKey) {
		t.Fatalf("list symlink error = %v; want ErrInvalidKey", err)
	}
	if err := s.DeletePrefix(context.Background(), "render-v2"); !errors.Is(err, ErrInvalidKey) {
		t.Fatalf("delete symlink prefix error = %v; want ErrInvalidKey", err)
	}
}

func TestValidateKey(t *testing.T) {
	valid := []string{
		"products/550e8400-e29b-41d4-a716-446655440000.webp",
		"products/42-stable-product/originals/image.webp",
		strings.Repeat("a", 170) + "/" + strings.Repeat("b", 170) + "/" + strings.Repeat("c", 170),
	}
	for _, key := range valid {
		if err := ValidateKey(key); err != nil {
			t.Errorf("ValidateKey(%q) = %v; want nil", key, err)
		}
	}

	for _, tt := range invalidKeyCases() {
		t.Run(tt.name, func(t *testing.T) {
			if err := ValidateKey(tt.key); !errors.Is(err, ErrInvalidKey) {
				t.Fatalf("ValidateKey(%q) = %v; want ErrInvalidKey", tt.key, err)
			}
		})
	}
}

func TestLocalStorage_AllOperationsRejectInvalidKeys(t *testing.T) {
	s, err := NewLocalStorage(t.TempDir())
	if err != nil {
		t.Fatalf("new: %v", err)
	}
	ctx := context.Background()
	operations := []struct {
		name string
		run  func(string) error
	}{
		{name: "put", run: func(key string) error {
			return s.Put(ctx, key, strings.NewReader("data"))
		}},
		{name: "put if absent", run: func(key string) error {
			return s.PutIfAbsent(ctx, key, strings.NewReader("data"))
		}},
		{name: "open", run: func(key string) error {
			rc, err := s.Open(ctx, key)
			if rc != nil {
				_ = rc.Close()
			}
			return err
		}},
		{name: "exists", run: func(key string) error {
			_, err := s.Exists(ctx, key)
			return err
		}},
		{name: "delete", run: func(key string) error {
			return s.Delete(ctx, key)
		}},
	}

	for _, tt := range invalidKeyCases() {
		t.Run(tt.name, func(t *testing.T) {
			for _, operation := range operations {
				t.Run(operation.name, func(t *testing.T) {
					if err := operation.run(tt.key); !errors.Is(err, ErrInvalidKey) {
						t.Fatalf("error = %v; want ErrInvalidKey", err)
					}
				})
			}
		})
	}
}

func TestLocalStorage_PutIfAbsentDoesNotClobber(t *testing.T) {
	s, err := NewLocalStorage(t.TempDir())
	if err != nil {
		t.Fatalf("new: %v", err)
	}
	ctx := context.Background()
	const key = "products/42-stable-product/original.webp"

	if err := s.PutIfAbsent(ctx, key, strings.NewReader("original")); err != nil {
		t.Fatalf("first put: %v", err)
	}
	if err := s.PutIfAbsent(ctx, key, strings.NewReader("replacement")); !errors.Is(err, ErrKeyExists) {
		t.Fatalf("collision error = %v; want ErrKeyExists", err)
	}
	if got := string(readObject(t, s, key)); got != "original" {
		t.Fatalf("after collision = %q; want original", got)
	}

	if err := s.Put(ctx, key, strings.NewReader("replacement")); err != nil {
		t.Fatalf("overwrite put: %v", err)
	}
	if got := string(readObject(t, s, key)); got != "replacement" {
		t.Fatalf("after overwrite = %q; want replacement", got)
	}
	assertNoSiblingTemps(t, s.Root(), key)
}

func TestLocalStorage_PutIfAbsentPublishesOneConcurrentWriter(t *testing.T) {
	s, err := NewLocalStorage(t.TempDir())
	if err != nil {
		t.Fatalf("new: %v", err)
	}
	const (
		key     = "products/42-stable-product/concurrent.webp"
		writers = 32
	)
	type result struct {
		payload byte
		err     error
	}
	start := make(chan struct{})
	results := make(chan result, writers)
	for i := range writers {
		go func() {
			<-start
			payload := byte(i)
			results <- result{
				payload: payload,
				err:     s.PutIfAbsent(context.Background(), key, bytes.NewReader([]byte{payload})),
			}
		}()
	}
	close(start)

	winner := byte(0)
	successes := 0
	for range writers {
		result := <-results
		switch {
		case result.err == nil:
			winner = result.payload
			successes++
		case !errors.Is(result.err, ErrKeyExists):
			t.Errorf("concurrent put error = %v; want ErrKeyExists", result.err)
		}
	}
	if successes != 1 {
		t.Fatalf("successful writers = %d; want 1", successes)
	}
	if got := readObject(t, s, key); len(got) != 1 || got[0] != winner {
		t.Fatalf("stored payload = %v; want winner %d", got, winner)
	}
	assertNoSiblingTemps(t, s.Root(), key)
}

func TestLocalStorage_PartialReaderLeavesNoArtifact(t *testing.T) {
	s, err := NewLocalStorage(t.TempDir())
	if err != nil {
		t.Fatalf("new: %v", err)
	}
	ctx := context.Background()
	const key = "products/42-stable-product/original.webp"
	readErr := errors.New("reader failed")
	r := io.MultiReader(strings.NewReader("partial"), failingReader{err: readErr})

	if err := s.PutIfAbsent(ctx, key, r); !errors.Is(err, readErr) {
		t.Fatalf("put error = %v; want reader failure", err)
	}
	if ok, err := s.Exists(ctx, key); err != nil || ok {
		t.Fatalf("exists = %v, %v; want false, nil", ok, err)
	}
	if _, err := os.Stat(filepath.Join(s.Root(), filepath.FromSlash(key))); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("destination stat error = %v; want os.ErrNotExist", err)
	}
	assertNoSiblingTemps(t, s.Root(), key)
}

func TestLocalStorage_PreventsSymlinkEscape(t *testing.T) {
	ctx := context.Background()

	t.Run("parent", func(t *testing.T) {
		root := t.TempDir()
		outside := t.TempDir()
		s, err := NewLocalStorage(root)
		if err != nil {
			t.Fatalf("new: %v", err)
		}
		outsideFile := filepath.Join(outside, "secret.txt")
		if err := os.WriteFile(outsideFile, []byte("secret"), 0o600); err != nil {
			t.Fatalf("seed outside file: %v", err)
		}
		if err := os.Symlink(outside, filepath.Join(root, "escape")); err != nil {
			t.Skipf("symlinks unavailable: %v", err)
		}

		const key = "escape/secret.txt"
		operations := []struct {
			name string
			run  func() error
		}{
			{name: "put", run: func() error { return s.Put(ctx, key, strings.NewReader("changed")) }},
			{name: "put if absent", run: func() error {
				return s.PutIfAbsent(ctx, key, strings.NewReader("changed"))
			}},
			{name: "open", run: func() error {
				rc, err := s.Open(ctx, key)
				if rc != nil {
					_ = rc.Close()
				}
				return err
			}},
			{name: "exists", run: func() error {
				_, err := s.Exists(ctx, key)
				return err
			}},
			{name: "delete", run: func() error { return s.Delete(ctx, key) }},
		}
		for _, operation := range operations {
			t.Run(operation.name, func(t *testing.T) {
				if err := operation.run(); err == nil {
					t.Fatal("operation succeeded through escaping symlink")
				}
				if got, err := os.ReadFile(outsideFile); err != nil || string(got) != "secret" {
					t.Fatalf("outside file = %q, %v; want secret, nil", got, err)
				}
			})
		}
	})

	t.Run("file", func(t *testing.T) {
		root := t.TempDir()
		outside := t.TempDir()
		s, err := NewLocalStorage(root)
		if err != nil {
			t.Fatalf("new: %v", err)
		}
		if err := os.MkdirAll(filepath.Join(root, "products"), 0o755); err != nil {
			t.Fatalf("mkdir products: %v", err)
		}
		outsideFile := filepath.Join(outside, "secret.txt")
		if err := os.WriteFile(outsideFile, []byte("secret"), 0o600); err != nil {
			t.Fatalf("seed outside file: %v", err)
		}
		const key = "products/link.webp"
		if err := os.Symlink(outsideFile, filepath.Join(root, filepath.FromSlash(key))); err != nil {
			t.Skipf("symlinks unavailable: %v", err)
		}

		if rc, err := s.Open(ctx, key); err == nil {
			_ = rc.Close()
			t.Fatal("open followed escaping file symlink")
		}
		if _, err := s.Exists(ctx, key); err == nil {
			t.Fatal("exists followed escaping file symlink")
		}
		if err := s.PutIfAbsent(ctx, key, strings.NewReader("changed")); !errors.Is(err, ErrKeyExists) {
			t.Fatalf("write-once error = %v; want ErrKeyExists", err)
		}
		if got, err := os.ReadFile(outsideFile); err != nil || string(got) != "secret" {
			t.Fatalf("outside file = %q, %v; want secret, nil", got, err)
		}

		// Atomic overwrite replaces the link itself rather than following it.
		if err := s.Put(ctx, key, strings.NewReader("inside")); err != nil {
			t.Fatalf("safe overwrite: %v", err)
		}
		if got := string(readObject(t, s, key)); got != "inside" {
			t.Fatalf("stored bytes = %q; want inside", got)
		}
		if got, err := os.ReadFile(outsideFile); err != nil || string(got) != "secret" {
			t.Fatalf("outside file = %q, %v; want secret, nil", got, err)
		}
	})
}

type invalidKeyCase struct {
	name string
	key  string
}

func invalidKeyCases() []invalidKeyCase {
	return []invalidKeyCase{
		{name: "empty", key: ""},
		{name: "overlong", key: strings.Repeat("a", 513)},
		{name: "absolute", key: "/products/image.webp"},
		{name: "windows absolute", key: "C:/products/image.webp"},
		{name: "backslash", key: `products\image.webp`},
		{name: "empty segment", key: "products//image.webp"},
		{name: "dot segment", key: "products/./image.webp"},
		{name: "dot dot segment", key: "products/../image.webp"},
		{name: "leading dot segment", key: "./products/image.webp"},
		{name: "trailing slash", key: "products/image.webp/"},
		{name: "nul", key: "products/\x00image.webp"},
		{name: "control", key: "products/\nimage.webp"},
		{name: "delete control", key: "products/\x7fimage.webp"},
		{name: "invalid utf8", key: string([]byte("products/\xffimage.webp"))},
		{name: "uppercase alias", key: "Products/image.webp"},
		{name: "query delimiter", key: "products/image?size.webp"},
		{name: "fragment delimiter", key: "products/image#cover.webp"},
		{name: "encoded delimiter", key: "products/image%2fcover.webp"},
		{name: "colon", key: "products/image:cover.webp"},
		{name: "space", key: "products/image cover.webp"},
		{name: "hidden segment", key: "products/.hidden.webp"},
		{name: "trailing dot", key: "products/image."},
		{name: "reserved windows name", key: "products/con.webp"},
		{name: "reserved windows device", key: "products/lpt1.webp"},
		{name: "overlong segment", key: "products/" + strings.Repeat("a", 256)},
	}
}

type failingReader struct {
	err error
}

func (r failingReader) Read([]byte) (int, error) {
	return 0, r.err
}

func readObject(t *testing.T, s *LocalStorage, key string) []byte {
	t.Helper()
	rc, err := s.Open(context.Background(), key)
	if err != nil {
		t.Fatalf("open %q: %v", key, err)
	}
	got, err := io.ReadAll(rc)
	if err != nil {
		_ = rc.Close()
		t.Fatalf("read %q: %v", key, err)
	}
	if err := rc.Close(); err != nil {
		t.Fatalf("close %q: %v", key, err)
	}
	return got
}

func assertNoSiblingTemps(t *testing.T, root, key string) {
	t.Helper()
	dir := filepath.Dir(filepath.Join(root, filepath.FromSlash(key)))
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("read destination directory: %v", err)
	}
	for _, entry := range entries {
		if strings.HasPrefix(entry.Name(), ".tmp-") {
			t.Errorf("temporary artifact remains: %s", entry.Name())
		}
	}
}
