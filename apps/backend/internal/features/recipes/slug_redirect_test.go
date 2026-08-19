package recipes

import (
	"context"
	"errors"
	"testing"

	"github.com/tiredbooy/internal/mocks"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

// redirectStub is minimalRepoStub backed by a live slug table, so rename and
// create go through the same code path the redirect record depends on.
func redirectStub() *minimalRepoStub {
	stub := &minimalRepoStub{
		redirects: map[string]int64{},
		slugs:     map[int64]string{},
	}
	stub.getByID = func(id int64) (*Recipe, error) {
		slug, ok := stub.slugs[id]
		if !ok {
			return nil, models.ErrNotFound
		}
		return &Recipe{ID: id, Slug: slug, Status: RecipeStatusPublished}, nil
	}
	stub.slugExists = func(slug string) (bool, error) {
		for _, live := range stub.slugs {
			if live == slug {
				return true, nil
			}
		}
		return false, nil
	}
	stub.create = func(req *RecipeReq) (*Recipe, error) {
		id := int64(100 + len(stub.slugs))
		stub.slugs[id] = req.Slug
		return &Recipe{ID: id, Slug: req.Slug, Status: req.Status}, nil
	}
	stub.update = func(id int64, req *RecipeUpdateReq) (*Recipe, error) {
		if req.Slug != nil {
			stub.slugs[id] = *req.Slug
		}
		return &Recipe{ID: id, Slug: stub.slugs[id], Status: RecipeStatusPublished}, nil
	}
	return stub
}

func renameRecipe(t *testing.T, svc Service, stub *minimalRepoStub, id int64, slug string) {
	t.Helper()
	if _, err := svc.Update(context.Background(), id, &RecipeUpdateReq{Slug: &slug}); err != nil {
		t.Fatalf("rename to %q: %v", slug, err)
	}
	if got := stub.slugs[id]; got != slug {
		t.Fatalf("live slug = %q, want %q", got, slug)
	}
}

func TestRecipeRenameLeavesRedirectRecord(t *testing.T) {
	stub := redirectStub()
	stub.slugs[4] = "old-fashioned"
	svc := NewService(stub, recipeBeginnerStub{tx: &mocks.FakeTx{}}, nil)

	renameRecipe(t, svc, stub, 4, "oldfashioned")

	target, err := svc.ResolveSlugRedirect(context.Background(), "old-fashioned")
	if err != nil {
		t.Fatalf("ResolveSlugRedirect: %v", err)
	}
	if target != "oldfashioned" {
		t.Fatalf("target = %q, want the renamed slug", target)
	}
	// The record points at the id, not at a slug — that is what keeps a second
	// rename from needing a rewrite.
	if stub.redirects["old-fashioned"] != 4 {
		t.Fatalf("record = %#v, want the recipe id", stub.redirects)
	}
}

func TestRecipeRenamedTwiceResolvesInOneHop(t *testing.T) {
	stub := redirectStub()
	stub.slugs[4] = "a"
	svc := NewService(stub, recipeBeginnerStub{tx: &mocks.FakeTx{}}, nil)

	renameRecipe(t, svc, stub, 4, "b")
	renameRecipe(t, svc, stub, 4, "c")

	for _, retired := range []string{"a", "b"} {
		target, err := svc.ResolveSlugRedirect(context.Background(), retired)
		if err != nil {
			t.Fatalf("ResolveSlugRedirect(%q): %v", retired, err)
		}
		if target != "c" {
			t.Fatalf("%q resolved to %q, want the current slug in one hop", retired, target)
		}
	}
}

func TestRecipeRenameDoesNotShadowTheSlugItMovedOnto(t *testing.T) {
	stub := redirectStub()
	stub.slugs[4] = "a"
	svc := NewService(stub, recipeBeginnerStub{tx: &mocks.FakeTx{}}, nil)

	renameRecipe(t, svc, stub, 4, "b")
	renameRecipe(t, svc, stub, 4, "a") // renamed back

	// "a" is live again, so it must no longer be a redirect source at all.
	if _, err := svc.ResolveSlugRedirect(context.Background(), "a"); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("resolve(a) = %v, want not found — a live slug outranks a record", err)
	}
	if target, err := svc.ResolveSlugRedirect(context.Background(), "b"); err != nil || target != "a" {
		t.Fatalf("resolve(b) = %q, %v; want the current slug", target, err)
	}
}

func TestRecipeReusedSlugDropsTheOldRecord(t *testing.T) {
	stub := redirectStub()
	stub.slugs[4] = "mojito"
	svc := NewService(stub, recipeBeginnerStub{tx: &mocks.FakeTx{}}, nil)

	renameRecipe(t, svc, stub, 4, "mojito-classic")
	if _, err := svc.ResolveSlugRedirect(context.Background(), "mojito"); err != nil {
		t.Fatalf("retired slug must redirect before it is re-used: %v", err)
	}

	// A different recipe now takes the retired slug. Traffic for it belongs to
	// the new recipe, never to the one that used to live there.
	created, err := svc.Create(context.Background(), &RecipeReq{
		Title:  "Mojito",
		Slug:   "mojito",
		Status: RecipeStatusPublished,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if created.Slug != "mojito" || created.ID == 4 {
		t.Fatalf("created = %+v, want a second recipe on the re-used slug", created)
	}
	if _, err := svc.ResolveSlugRedirect(context.Background(), "mojito"); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("resolve(mojito) = %v, want not found — the record must not outlive the re-use", err)
	}
}

func TestRecipeResolveSlugRedirectRejectsEmptyAndUnknown(t *testing.T) {
	stub := redirectStub()
	svc := NewService(stub, recipeBeginnerStub{tx: &mocks.FakeTx{}}, nil)

	if _, err := svc.ResolveSlugRedirect(context.Background(), ""); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("empty slug error = %v, want invalid request", err)
	}
	if _, err := svc.ResolveSlugRedirect(context.Background(), "never-existed"); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("unknown slug error = %v, want not found", err)
	}
}
