// Package storage abstracts where original media bytes are persisted. The
// local-disk implementation is the only one today; an S3/MinIO backend can be
// added later behind the same Storage interface without touching callers (the
// media service, handlers, etc.).
package storage

import (
	"context"
	"errors"
	"io"
	"path"
	"strings"
	"unicode/utf8"
)

// ErrInvalidKey is returned when a key is not a canonical storage key.
var ErrInvalidKey = errors.New("storage: invalid key")

// ErrKeyExists is returned by write-once storage when key already exists.
var ErrKeyExists = errors.New("storage: key already exists")

const maxKeyBytes = 512

// ValidateKey accepts canonical, relative, forward-slash storage keys.
func ValidateKey(key string) error {
	if key == "" || len(key) > maxKeyBytes || !utf8.ValidString(key) {
		return ErrInvalidKey
	}
	if path.IsAbs(key) || strings.ContainsRune(key, '\\') || hasWindowsDrivePrefix(key) {
		return ErrInvalidKey
	}
	for _, segment := range strings.Split(key, "/") {
		if !validKeySegment(segment) {
			return ErrInvalidKey
		}
	}
	if path.Clean(key) != key {
		return ErrInvalidKey
	}
	return nil
}

func validKeySegment(segment string) bool {
	if segment == "" || len(segment) > 255 || !isLowerAlphaNumeric(segment[0]) {
		return false
	}
	for i := range len(segment) {
		b := segment[i]
		if !isLowerAlphaNumeric(b) && b != '-' && b != '_' && b != '.' {
			return false
		}
	}
	if segment[len(segment)-1] == '.' {
		return false
	}
	base := strings.SplitN(segment, ".", 2)[0]
	switch base {
	case "con", "prn", "aux", "nul",
		"com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9",
		"lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9":
		return false
	}
	return true
}

func isLowerAlphaNumeric(b byte) bool {
	return b >= 'a' && b <= 'z' || b >= '0' && b <= '9'
}

func hasWindowsDrivePrefix(key string) bool {
	if len(key) < 2 || key[1] != ':' {
		return false
	}
	return key[0] >= 'a' && key[0] <= 'z' || key[0] >= 'A' && key[0] <= 'Z'
}

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

// WriteOnceStorage adds atomic, no-clobber publication for immutable objects.
type WriteOnceStorage interface {
	Storage
	PutIfAbsent(ctx context.Context, key string, r io.Reader) error
}
