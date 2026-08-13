package media

import (
	"errors"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/tiredbooy/pkg/storage"
)

type OwnerKind string

const (
	MediaOwnerProduct   OwnerKind = "products"
	MediaOwnerHeroSlide OwnerKind = "hero-slides"
	MediaOwnerRecipe    OwnerKind = "recipes"
	MediaOwnerJournal   OwnerKind = "journal"
)

type Role string

const (
	RoleGallery Role = "gallery"
	RoleDesktop Role = "desktop"
	RoleMobile  Role = "mobile"
	RoleCover   Role = "cover"
	RoleOG      Role = "og"
)

var ErrInvalidMediaOwner = errors.New("media: invalid owner or role")

func contentMediaSlot(ownerType, role string) (OwnerKind, Role, error) {
	kind := OwnerKind(ownerType)
	mediaRole := Role(role)
	switch kind {
	case MediaOwnerHeroSlide:
		if mediaRole == RoleDesktop || mediaRole == RoleMobile {
			return kind, mediaRole, nil
		}
	case MediaOwnerRecipe:
		if mediaRole == RoleCover || mediaRole == RoleOG {
			return kind, mediaRole, nil
		}
	case MediaOwnerJournal:
		if mediaRole == RoleCover {
			return kind, mediaRole, nil
		}
	}
	return "", "", ErrInvalidMediaOwner
}

func mediaStorageKey(
	kind OwnerKind,
	ownerID int64,
	ownerSlug string,
	role Role,
	objectID string,
	ext string,
) (string, error) {
	if ownerID <= 0 || uuid.Validate(objectID) != nil || !isStoredImageExtension(ext) {
		return "", ErrInvalidMediaOwner
	}

	id := strconv.FormatInt(ownerID, 10)
	var directory string
	switch kind {
	case MediaOwnerProduct:
		if role != RoleGallery {
			return "", ErrInvalidMediaOwner
		}
		directory = string(kind) + "/" + id
		if slug := sanitizeMediaSlug(ownerSlug); slug != "" {
			directory += "-" + slug
		}
	case MediaOwnerHeroSlide:
		if role != RoleDesktop && role != RoleMobile {
			return "", ErrInvalidMediaOwner
		}
		directory = string(kind) + "/" + id
	case MediaOwnerRecipe:
		if role != RoleCover && role != RoleOG {
			return "", ErrInvalidMediaOwner
		}
		directory = string(kind) + "/" + id
	case MediaOwnerJournal:
		if role != RoleCover {
			return "", ErrInvalidMediaOwner
		}
		directory = string(kind) + "/" + id
	default:
		return "", ErrInvalidMediaOwner
	}

	key := directory + "/" + string(role) + "-" + objectID + "." + ext
	if err := storage.ValidateKey(key); err != nil {
		return "", ErrInvalidMediaOwner
	}
	return key, nil
}

func canonicalMediaPath(key string) (string, error) {
	if err := storage.ValidateKey(key); err != nil {
		return "", err
	}
	return "/media/" + key, nil
}

func isStoredImageExtension(ext string) bool {
	switch ext {
	case "jpg", "png", "webp", "gif", "avif":
		return true
	default:
		return false
	}
}

// Product slugs are decoration only: the numeric owner ID remains the stable
// identity. ASCII output and a short byte cap keep directory components portable.
func sanitizeMediaSlug(value string) string {
	const maxBytes = 80

	var b strings.Builder
	b.Grow(min(len(value), maxBytes))
	separator := false
	for _, r := range strings.ToLower(strings.TrimSpace(value)) {
		valid := r >= 'a' && r <= 'z' || r >= '0' && r <= '9'
		if !valid {
			separator = b.Len() > 0
			continue
		}
		if separator {
			if b.Len()+1 >= maxBytes {
				break
			}
			b.WriteByte('-')
			separator = false
		}
		if b.Len() >= maxBytes {
			break
		}
		b.WriteRune(r)
	}
	return strings.TrimRight(b.String(), "-")
}
