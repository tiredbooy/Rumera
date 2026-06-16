package storage

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// LocalStorage stores objects as files under a single root directory. Keys map
// to paths beneath the root; any key that would escape the root (via "..",
// absolute paths, etc.) is rejected with ErrInvalidKey.
type LocalStorage struct {
	root string
}

// NewLocalStorage resolves root to an absolute path and ensures it exists.
func NewLocalStorage(root string) (*LocalStorage, error) {
	abs, err := filepath.Abs(root)
	if err != nil {
		return nil, fmt.Errorf("storage: resolve root: %w", err)
	}
	if err := os.MkdirAll(abs, 0o755); err != nil {
		return nil, fmt.Errorf("storage: create root: %w", err)
	}
	return &LocalStorage{root: abs}, nil
}

// Root returns the absolute root directory (useful for diagnostics).
func (s *LocalStorage) Root() string { return s.root }

// resolve maps a slash-separated key to an absolute path guaranteed to live
// inside the root. It rejects empty keys and any key that escapes the root.
func (s *LocalStorage) resolve(key string) (string, error) {
	if key == "" || key == "." {
		return "", ErrInvalidKey
	}
	// Reject absolute keys and any traversal segment outright — a legitimate key
	// is always a plain relative path like "products/<uuid>.<ext>".
	if strings.HasPrefix(key, "/") || strings.HasPrefix(key, `\`) {
		return "", ErrInvalidKey
	}
	for _, seg := range strings.Split(filepath.ToSlash(key), "/") {
		if seg == ".." {
			return "", ErrInvalidKey
		}
	}

	full := filepath.Join(s.root, filepath.Clean(filepath.FromSlash(key)))

	// Defence in depth: confirm the result sits beneath the root.
	if full == s.root || !strings.HasPrefix(full, s.root+string(os.PathSeparator)) {
		return "", ErrInvalidKey
	}
	return full, nil
}

// Put writes r to key atomically: bytes go to a sibling temp file which is then
// renamed into place, so a crash mid-write never leaves a half-written object.
func (s *LocalStorage) Put(ctx context.Context, key string, r io.Reader) error {
	full, err := s.resolve(key)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		return fmt.Errorf("storage: mkdir: %w", err)
	}

	tmp, err := os.CreateTemp(filepath.Dir(full), ".tmp-*")
	if err != nil {
		return fmt.Errorf("storage: temp file: %w", err)
	}
	tmpName := tmp.Name()
	// Best-effort cleanup if we don't make it to the rename.
	defer func() { _ = os.Remove(tmpName) }()

	if _, err := io.Copy(tmp, r); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("storage: write: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("storage: close temp: %w", err)
	}
	if err := os.Rename(tmpName, full); err != nil {
		return fmt.Errorf("storage: rename: %w", err)
	}
	return nil
}

// Open returns a reader for key; the error satisfies os.ErrNotExist when absent.
func (s *LocalStorage) Open(ctx context.Context, key string) (io.ReadCloser, error) {
	full, err := s.resolve(key)
	if err != nil {
		return nil, err
	}
	f, err := os.Open(full)
	if err != nil {
		return nil, err // wraps os.ErrNotExist when missing
	}
	return f, nil
}

// Exists reports whether key resolves to an existing file.
func (s *LocalStorage) Exists(ctx context.Context, key string) (bool, error) {
	full, err := s.resolve(key)
	if err != nil {
		return false, err
	}
	info, err := os.Stat(full)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, err
	}
	return !info.IsDir(), nil
}

// Delete removes key; a missing key is not an error.
func (s *LocalStorage) Delete(ctx context.Context, key string) error {
	full, err := s.resolve(key)
	if err != nil {
		return err
	}
	if err := os.Remove(full); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("storage: delete: %w", err)
	}
	return nil
}

// Compile-time assertion that LocalStorage satisfies Storage.
var _ Storage = (*LocalStorage)(nil)
