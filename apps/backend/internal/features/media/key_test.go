package media

import (
	"errors"
	"strings"
	"testing"
)

const testMediaObjectID = "550e8400-e29b-41d4-a716-446655440000"

func TestMediaStorageKey(t *testing.T) {
	tests := []struct {
		name string
		kind OwnerKind
		id   int64
		slug string
		role Role
		want string
	}{
		{
			name: "product with sanitized slug",
			kind: MediaOwnerProduct,
			id:   42,
			slug: "  Reserve / Red_Wine .. 2026  ",
			role: RoleGallery,
			want: "products/42-reserve-red-wine-2026/gallery-" + testMediaObjectID + ".webp",
		},
		{
			name: "product with non-ascii slug uses stable id",
			kind: MediaOwnerProduct,
			id:   42,
			slug: "هدیه ویژه",
			role: RoleGallery,
			want: "products/42/gallery-" + testMediaObjectID + ".webp",
		},
		{
			name: "hero desktop",
			kind: MediaOwnerHeroSlide,
			id:   7,
			role: RoleDesktop,
			want: "hero-slides/7/desktop-" + testMediaObjectID + ".webp",
		},
		{
			name: "hero mobile",
			kind: MediaOwnerHeroSlide,
			id:   7,
			role: RoleMobile,
			want: "hero-slides/7/mobile-" + testMediaObjectID + ".webp",
		},
		{
			name: "recipe cover",
			kind: MediaOwnerRecipe,
			id:   11,
			role: RoleCover,
			want: "recipes/11/cover-" + testMediaObjectID + ".webp",
		},
		{
			name: "recipe open graph",
			kind: MediaOwnerRecipe,
			id:   11,
			role: RoleOG,
			want: "recipes/11/og-" + testMediaObjectID + ".webp",
		},
		{
			name: "journal cover",
			kind: MediaOwnerJournal,
			id:   19,
			role: RoleCover,
			want: "journal/19/cover-" + testMediaObjectID + ".webp",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := mediaStorageKey(tt.kind, tt.id, tt.slug, tt.role, testMediaObjectID, "webp")
			if err != nil {
				t.Fatalf("mediaStorageKey: %v", err)
			}
			if got != tt.want {
				t.Fatalf("key = %q; want %q", got, tt.want)
			}
		})
	}
}

func TestMediaStorageKeyRejectsInvalidContracts(t *testing.T) {
	tests := []struct {
		name string
		kind OwnerKind
		id   int64
		role Role
		uid  string
		ext  string
	}{
		{name: "unknown owner", kind: "unknown", id: 1, role: RoleCover, uid: testMediaObjectID, ext: "webp"},
		{name: "non-positive id", kind: MediaOwnerRecipe, id: 0, role: RoleCover, uid: testMediaObjectID, ext: "webp"},
		{name: "wrong role", kind: MediaOwnerHeroSlide, id: 1, role: RoleCover, uid: testMediaObjectID, ext: "webp"},
		{name: "invalid uuid", kind: MediaOwnerRecipe, id: 1, role: RoleCover, uid: "../escape", ext: "webp"},
		{name: "invalid extension", kind: MediaOwnerRecipe, id: 1, role: RoleCover, uid: testMediaObjectID, ext: "svg"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := mediaStorageKey(tt.kind, tt.id, "slug", tt.role, tt.uid, tt.ext)
			if !errors.Is(err, ErrInvalidMediaOwner) {
				t.Fatalf("error = %v; want ErrInvalidMediaOwner", err)
			}
		})
	}
}

func TestContentMediaSlotUsesClosedOwnerRoleMatrix(t *testing.T) {
	valid := []struct {
		ownerType string
		role      string
		kind      OwnerKind
		mediaRole Role
	}{
		{ownerType: "hero-slides", role: "desktop", kind: MediaOwnerHeroSlide, mediaRole: RoleDesktop},
		{ownerType: "hero-slides", role: "mobile", kind: MediaOwnerHeroSlide, mediaRole: RoleMobile},
		{ownerType: "recipes", role: "cover", kind: MediaOwnerRecipe, mediaRole: RoleCover},
		{ownerType: "recipes", role: "og", kind: MediaOwnerRecipe, mediaRole: RoleOG},
		{ownerType: "journal", role: "cover", kind: MediaOwnerJournal, mediaRole: RoleCover},
		{ownerType: "journal", role: "og", kind: MediaOwnerJournal, mediaRole: RoleOG},
	}
	for _, tt := range valid {
		t.Run(tt.ownerType+" "+tt.role, func(t *testing.T) {
			kind, role, err := contentMediaSlot(tt.ownerType, tt.role)
			if err != nil || kind != tt.kind || role != tt.mediaRole {
				t.Fatalf("contentMediaSlot = %q, %q, %v; want %q, %q, nil", kind, role, err, tt.kind, tt.mediaRole)
			}
		})
	}

	invalid := [][2]string{
		{"products", "gallery"},
		{"hero", "desktop"},
		{"hero-slides", "cover"},
		{"recipes", "desktop"},
		{"journal", "desktop"},
		{"journals", "cover"},
	}
	for _, tt := range invalid {
		if _, _, err := contentMediaSlot(tt[0], tt[1]); !errors.Is(err, ErrInvalidMediaOwner) {
			t.Errorf("contentMediaSlot(%q, %q) error = %v; want ErrInvalidMediaOwner", tt[0], tt[1], err)
		}
	}
}

func TestSanitizeMediaSlugIsBounded(t *testing.T) {
	got := sanitizeMediaSlug(strings.Repeat("Very Long / ", 30))
	if len(got) > 80 {
		t.Fatalf("slug length = %d; want <= 80", len(got))
	}
	if strings.ContainsAny(got, "/\\._ ") || strings.HasSuffix(got, "-") {
		t.Fatalf("slug is not canonical: %q", got)
	}
}

func TestCanonicalMediaPath(t *testing.T) {
	const key = "products/42-red/gallery-550e8400-e29b-41d4-a716-446655440000.webp"
	got, err := canonicalMediaPath(key)
	if err != nil || got != "/media/"+key {
		t.Fatalf("canonicalMediaPath = %q, %v", got, err)
	}
	if _, err := canonicalMediaPath("products/../escape.webp"); err == nil {
		t.Fatal("canonicalMediaPath accepted traversal")
	}
}
