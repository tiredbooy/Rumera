package storage

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
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

// resolve maps a canonical key to a path relative to the storage root.
func (s *LocalStorage) resolve(key string) (string, error) {
	if err := ValidateKey(key); err != nil {
		return "", ErrInvalidKey
	}

	full := filepath.Join(s.root, filepath.FromSlash(key))
	rel, err := filepath.Rel(s.root, full)
	if err != nil {
		return "", ErrInvalidKey
	}
	if rel == "." || rel == ".." || filepath.IsAbs(rel) ||
		strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
		return "", ErrInvalidKey
	}
	if filepath.ToSlash(rel) != key {
		return "", ErrInvalidKey
	}
	return rel, nil
}

// Put writes r to key atomically: bytes go to a sibling temp file which is then
// renamed into place, so a crash mid-write never leaves a half-written object.
func (s *LocalStorage) Put(ctx context.Context, key string, r io.Reader) error {
	return s.put(key, r, false)
}

// PutIfAbsent atomically publishes key without replacing an existing object.
func (s *LocalStorage) PutIfAbsent(ctx context.Context, key string, r io.Reader) error {
	return s.put(key, r, true)
}

func (s *LocalStorage) put(key string, r io.Reader, noClobber bool) error {
	rel, err := s.resolve(key)
	if err != nil {
		return err
	}

	root, err := os.OpenRoot(s.root)
	if err != nil {
		return fmt.Errorf("storage: open root: %w", err)
	}
	defer func() { _ = root.Close() }()

	parent := filepath.Dir(rel)
	if parent != "." {
		if err := root.MkdirAll(parent, 0o755); err != nil {
			return fmt.Errorf("storage: mkdir: %w", err)
		}
	}

	tmp, tmpName, err := createSiblingTemp(root, rel)
	if err != nil {
		return err
	}
	cleanup := true
	defer func() {
		if cleanup {
			_ = root.Remove(tmpName)
		}
	}()
	defer func() { _ = tmp.Close() }()

	if _, err := io.Copy(tmp, r); err != nil {
		return fmt.Errorf("storage: write: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("storage: close temp: %w", err)
	}

	if noClobber {
		if err := root.Link(tmpName, rel); err != nil {
			if errors.Is(err, os.ErrExist) {
				return ErrKeyExists
			}
			return fmt.Errorf("storage: publish: %w", err)
		}
		// Publication is authoritative once the hard link lands. A failed temp-link
		// cleanup must not make callers treat the immutable destination as absent.
		if err := root.Remove(tmpName); err == nil {
			cleanup = false
		}
		return nil
	}

	if err := root.Rename(tmpName, rel); err != nil {
		return fmt.Errorf("storage: rename: %w", err)
	}
	cleanup = false
	return nil
}

func createSiblingTemp(root *os.Root, target string) (*os.File, string, error) {
	dir := filepath.Dir(target)
	for range 100 {
		var suffix [16]byte
		if _, err := rand.Read(suffix[:]); err != nil {
			return nil, "", fmt.Errorf("storage: temp name: %w", err)
		}
		name := filepath.Join(dir, fmt.Sprintf(".tmp-%x", suffix))
		f, err := root.OpenFile(name, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
		if errors.Is(err, os.ErrExist) {
			continue
		}
		if err != nil {
			return nil, "", fmt.Errorf("storage: temp file: %w", err)
		}
		return f, name, nil
	}
	return nil, "", fmt.Errorf("storage: temp file: too many name collisions")
}

// Open returns a reader for key; the error satisfies os.ErrNotExist when absent.
func (s *LocalStorage) Open(ctx context.Context, key string) (io.ReadCloser, error) {
	rel, err := s.resolve(key)
	if err != nil {
		return nil, err
	}
	root, err := os.OpenRoot(s.root)
	if err != nil {
		return nil, fmt.Errorf("storage: open root: %w", err)
	}
	defer func() { _ = root.Close() }()

	f, err := root.Open(rel)
	if err != nil {
		return nil, err
	}
	return f, nil
}

// Exists reports whether key resolves to an existing file.
func (s *LocalStorage) Exists(ctx context.Context, key string) (bool, error) {
	rel, err := s.resolve(key)
	if err != nil {
		return false, err
	}
	root, err := os.OpenRoot(s.root)
	if err != nil {
		return false, fmt.Errorf("storage: open root: %w", err)
	}
	defer func() { _ = root.Close() }()

	info, err := root.Stat(rel)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return false, nil
		}
		return false, err
	}
	return !info.IsDir(), nil
}

// Delete removes key; a missing key is not an error.
func (s *LocalStorage) Delete(ctx context.Context, key string) error {
	rel, err := s.resolve(key)
	if err != nil {
		return err
	}
	root, err := os.OpenRoot(s.root)
	if err != nil {
		return fmt.Errorf("storage: open root: %w", err)
	}
	defer func() { _ = root.Close() }()

	if err := root.Remove(rel); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("storage: delete: %w", err)
	}
	return nil
}

// List walks regular objects below prefix without following symlinks. Empty
// prefix means the complete storage namespace and is used by reconciliation.
func (s *LocalStorage) List(ctx context.Context, prefix string) ([]ObjectInfo, error) {
	rel := "."
	if prefix != "" {
		var err error
		rel, err = s.resolve(prefix)
		if err != nil {
			return nil, err
		}
	}

	root, err := os.OpenRoot(s.root)
	if err != nil {
		return nil, fmt.Errorf("storage: open root: %w", err)
	}
	defer func() { _ = root.Close() }()

	info, err := root.Lstat(rel)
	if errors.Is(err, os.ErrNotExist) {
		return []ObjectInfo{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("storage: list prefix: %w", err)
	}
	if info.Mode()&os.ModeSymlink != 0 {
		return nil, fmt.Errorf("storage: list prefix symlink: %w", ErrInvalidKey)
	}
	if !info.IsDir() {
		if !info.Mode().IsRegular() || prefix == "" {
			return nil, fmt.Errorf("storage: list non-regular object: %w", ErrInvalidKey)
		}
		return []ObjectInfo{{Key: prefix, Size: info.Size(), ModTime: info.ModTime()}}, nil
	}

	objects := make([]ObjectInfo, 0)
	var walk func(string) error
	walk = func(dir string) error {
		if err := ctx.Err(); err != nil {
			return err
		}
		opened, err := root.Open(dir)
		if err != nil {
			return fmt.Errorf("storage: open list directory: %w", err)
		}
		entries, readErr := opened.ReadDir(-1)
		closeErr := opened.Close()
		if readErr != nil {
			return fmt.Errorf("storage: read list directory: %w", readErr)
		}
		if closeErr != nil {
			return fmt.Errorf("storage: close list directory: %w", closeErr)
		}
		sort.Slice(entries, func(i, j int) bool { return entries[i].Name() < entries[j].Name() })

		for _, entry := range entries {
			child := filepath.Join(dir, entry.Name())
			childInfo, err := root.Lstat(child)
			if err != nil {
				return fmt.Errorf("storage: inspect listed object: %w", err)
			}
			if childInfo.Mode()&os.ModeSymlink != 0 {
				return fmt.Errorf("storage: listed symlink %q: %w", filepath.ToSlash(child), ErrInvalidKey)
			}
			if childInfo.IsDir() {
				if err := walk(child); err != nil {
					return err
				}
				continue
			}
			if !childInfo.Mode().IsRegular() {
				return fmt.Errorf("storage: listed non-regular object %q: %w", filepath.ToSlash(child), ErrInvalidKey)
			}
			key := filepath.ToSlash(child)
			if err := ValidateKey(key); err != nil {
				// In-progress sibling temp files are not published storage objects.
				if strings.HasPrefix(entry.Name(), ".tmp-") {
					continue
				}
				return fmt.Errorf("storage: listed invalid key %q: %w", key, err)
			}
			objects = append(objects, ObjectInfo{Key: key, Size: childInfo.Size(), ModTime: childInfo.ModTime()})
		}
		return nil
	}

	if err := walk(rel); err != nil {
		return nil, err
	}
	sort.Slice(objects, func(i, j int) bool { return objects[i].Key < objects[j].Key })
	return objects, nil
}

// DeletePrefix removes a validated non-empty namespace. Listing first rejects
// symlinks or special files before any destructive operation begins.
func (s *LocalStorage) DeletePrefix(ctx context.Context, prefix string) error {
	if err := ValidateKey(prefix); err != nil {
		return err
	}
	if _, err := s.List(ctx, prefix); err != nil {
		return err
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	rel, err := s.resolve(prefix)
	if err != nil {
		return err
	}
	root, err := os.OpenRoot(s.root)
	if err != nil {
		return fmt.Errorf("storage: open root: %w", err)
	}
	defer func() { _ = root.Close() }()
	if err := root.RemoveAll(rel); err != nil {
		return fmt.Errorf("storage: delete prefix: %w", err)
	}
	return nil
}

// Compile-time assertions for both storage contracts.
var (
	_ Storage          = (*LocalStorage)(nil)
	_ WriteOnceStorage = (*LocalStorage)(nil)
)
