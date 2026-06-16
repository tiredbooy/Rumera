// Package storage abstracts where original media bytes are persisted. The
// local-disk implementation is the only one today; an S3/MinIO backend can be
// added later behind the same Storage interface without touching callers (the
// media service, handlers, etc.).
package storage

import (
	"context"
	"errors"
	"io"
)

// ErrInvalidKey is returned when a key would resolve outside the storage root
// (path traversal) or is otherwise unusable.
var ErrInvalidKey = errors.New("storage: invalid key")

// Storage persists and retrieves opaque blobs addressed by a forward-slash key
// such as "products/9f8c…d2.webp". Implementations must treat keys as untrusted
// input and never let one escape the backend's namespace.
type Storage interface {
	// Put stores all bytes from r under key, overwriting any existing object.
	// Parent "directories" are created as needed. The write is atomic where the
	// backend allows it (a partial failure leaves no object behind).
	Put(ctx context.Context, key string, r io.Reader) error

	// Open returns a reader for key. It returns an error satisfying
	// errors.Is(err, os.ErrNotExist) when the key does not exist. The caller
	// must Close the returned reader.
	Open(ctx context.Context, key string) (io.ReadCloser, error)

	// Exists reports whether key currently resolves to a stored object.
	Exists(ctx context.Context, key string) (bool, error)

	// Delete removes key. It is not an error to delete a key that is absent.
	Delete(ctx context.Context, key string) error
}
