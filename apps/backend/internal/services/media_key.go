package services

import (
	"errors"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/tiredbooy/pkg/storage"
)

type MediaOwnerKind string

const (
	MediaOwnerProduct   MediaOwnerKind = "products"
	MediaOwnerHeroSlide MediaOwnerKind = "hero-slides"
	MediaOwnerRecipe    MediaOwnerKind = "recipes"
	MediaOwnerJournal   MediaOwnerKind = "journal"
)

type MediaRole string

const (
	MediaRoleGallery MediaRole = "gallery"
	MediaRoleDesktop MediaRole = "desktop"
	MediaRoleMobile  MediaRole = "mobile"
	MediaRoleCover   MediaRole = "cover"
	MediaRoleOG      MediaRole = "og"
)

var ErrInvalidMediaOwner = errors.New("media: invalid owner or role")

func contentMediaSlot(ownerType, role string) (MediaOwnerKind, MediaRole, error) {
	kind := MediaOwnerKind(ownerType)
	mediaRole := MediaRole(role)
	switch kind {
	case MediaOwnerHeroSlide:
		if mediaRole == MediaRoleDesktop || mediaRole == MediaRoleMobile {
			return kind, mediaRole, nil
		}
	case MediaOwnerRecipe:
		if mediaRole == MediaRoleCover || mediaRole == MediaRoleOG {
			return kind, mediaRole, nil
		}
	case MediaOwnerJournal:
		if mediaRole == MediaRoleCover {
			return kind, mediaRole, nil
		}
	}
	return "", "", ErrInvalidMediaOwner
}

func mediaStorageKey(
	kind MediaOwnerKind,
	ownerID int64,
	ownerSlug string,
	role MediaRole,
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
		if role != MediaRoleGallery {
			return "", ErrInvalidMediaOwner
		}
		directory = string(kind) + "/" + id
		if slug := sanitizeMediaSlug(ownerSlug); slug != "" {
			directory += "-" + slug
		}
	case MediaOwnerHeroSlide:
		if role != MediaRoleDesktop && role != MediaRoleMobile {
			return "", ErrInvalidMediaOwner
		}
		directory = string(kind) + "/" + id
	case MediaOwnerRecipe:
		if role != MediaRoleCover && role != MediaRoleOG {
			return "", ErrInvalidMediaOwner
		}
		directory = string(kind) + "/" + id
	case MediaOwnerJournal:
		if role != MediaRoleCover {
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
