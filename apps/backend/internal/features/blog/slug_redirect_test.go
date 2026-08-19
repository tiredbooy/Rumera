package blog

import (
	"context"
	"errors"
	"testing"

	"github.com/tiredbooy/internal/mocks"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

// redirectStub is blogRepositoryStub backed by a live slug table, so rename and
// create go through the same code path the redirect record depends on.
func redirectStub() *blogRepositoryStub {
	stub := &blogRepositoryStub{
		redirects: map[string]int64{},
		slugs:     map[int64]string{},
	}
	stub.getByID = func(id int64) (*Blog, error) {
		slug, ok := stub.slugs[id]
		if !ok {
			return nil, models.ErrNotFound
		}
		return &Blog{ID: id, Slug: slug, Status: BlogStatusPublished}, nil
	}
	stub.slugExists = func(slug string) (bool, error) {
		for _, live := range stub.slugs {
			if live == slug {
				return true, nil
			}
		}
		return false, nil
	}
	stub.create = func(req *BlogReq) (*Blog, error) {
		id := int64(100 + len(stub.slugs))
		stub.slugs[id] = req.Slug
		return &Blog{ID: id, Title: req.Title, Slug: req.Slug, Status: req.Status}, nil
	}
	stub.update = func(id int64, req *BlogUpdateReq) (*Blog, error) {
		if req.Slug != nil {
			stub.slugs[id] = *req.Slug
		}
		return &Blog{ID: id, Slug: stub.slugs[id], Status: BlogStatusPublished}, nil
	}
	return stub
}

func renamePost(t *testing.T, svc Service, stub *blogRepositoryStub, id int64, slug string) {
	t.Helper()
	if _, err := svc.Update(context.Background(), id, &BlogUpdateReq{Slug: &slug}); err != nil {
		t.Fatalf("rename to %q: %v", slug, err)
	}
	if got := stub.slugs[id]; got != slug {
		t.Fatalf("live slug = %q, want %q", got, slug)
	}
}

func TestBlogRenameLeavesRedirectRecord(t *testing.T) {
	stub := redirectStub()
	stub.slugs[7] = "serving-guide"
	svc := NewService(stub, blogBeginnerStub{tx: &mocks.FakeTx{}}, nil)

	renamePost(t, svc, stub, 7, "how-to-serve")

	target, err := svc.ResolveSlugRedirect(context.Background(), "serving-guide")
	if err != nil {
		t.Fatalf("ResolveSlugRedirect: %v", err)
	}
	if target != "how-to-serve" {
		t.Fatalf("target = %q, want the renamed slug", target)
	}
	// The record points at the id, not at a slug — that is what keeps a second
	// rename from needing a rewrite.
	if stub.redirects["serving-guide"] != 7 {
		t.Fatalf("record = %#v, want the post id", stub.redirects)
	}
}

func TestBlogRenamedTwiceResolvesInOneHop(t *testing.T) {
	stub := redirectStub()
	stub.slugs[7] = "a"
	svc := NewService(stub, blogBeginnerStub{tx: &mocks.FakeTx{}}, nil)

	renamePost(t, svc, stub, 7, "b")
	renamePost(t, svc, stub, 7, "c")

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

func TestBlogRenameDoesNotShadowTheSlugItMovedOnto(t *testing.T) {
	stub := redirectStub()
	stub.slugs[7] = "a"
	svc := NewService(stub, blogBeginnerStub{tx: &mocks.FakeTx{}}, nil)

	renamePost(t, svc, stub, 7, "b")
	renamePost(t, svc, stub, 7, "a") // renamed back

	// "a" is live again, so it must no longer be a redirect source at all.
	if _, err := svc.ResolveSlugRedirect(context.Background(), "a"); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("resolve(a) = %v, want not found — a live slug outranks a record", err)
	}
	if target, err := svc.ResolveSlugRedirect(context.Background(), "b"); err != nil || target != "a" {
		t.Fatalf("resolve(b) = %q, %v; want the current slug", target, err)
	}
}

func TestBlogReusedSlugDropsTheOldRecord(t *testing.T) {
	stub := redirectStub()
	stub.slugs[7] = "negroni"
	svc := NewService(stub, blogBeginnerStub{tx: &mocks.FakeTx{}}, nil)

	renamePost(t, svc, stub, 7, "negroni-history")
	if _, err := svc.ResolveSlugRedirect(context.Background(), "negroni"); err != nil {
		t.Fatalf("retired slug must redirect before it is re-used: %v", err)
	}

	// A different post now takes the retired slug. Traffic for it belongs to the
	// new post, never to the one that used to live there.
	created, err := svc.Create(context.Background(), &BlogReq{
		Title:   "نگرونی",
		Slug:    "negroni",
		Content: "<p>متن</p>",
		Status:  BlogStatusPublished,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if created.Slug != "negroni" || created.ID == 7 {
		t.Fatalf("created = %+v, want a second post on the re-used slug", created)
	}
	if _, err := svc.ResolveSlugRedirect(context.Background(), "negroni"); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("resolve(negroni) = %v, want not found — the record must not outlive the re-use", err)
	}
}

func TestBlogResolveSlugRedirectRejectsEmptyAndUnknown(t *testing.T) {
	stub := redirectStub()
	svc := NewService(stub, blogBeginnerStub{tx: &mocks.FakeTx{}}, nil)

	if _, err := svc.ResolveSlugRedirect(context.Background(), ""); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("empty slug error = %v, want invalid request", err)
	}
	if _, err := svc.ResolveSlugRedirect(context.Background(), "never-existed"); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("unknown slug error = %v, want not found", err)
	}
}
