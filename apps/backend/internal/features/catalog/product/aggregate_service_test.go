package product

import (
	"context"
	"testing"

	"github.com/google/uuid"
)

type aggregateReplayRepository struct {
	Repository
	result    *ProductAggregateWriteResult
	findCalls int
	saveCalls int
}

func (r *aggregateReplayRepository) FindAggregateOperation(
	_ context.Context,
	_, requestHash string,
) (*ProductAggregateWriteResult, error) {
	r.findCalls++
	if requestHash == "" {
		panic("aggregate request hash must not be empty")
	}
	return r.result, nil
}

func (r *aggregateReplayRepository) SaveAggregate(
	context.Context,
	int64,
	string,
	SaveProductAggregateReq,
) (*ProductAggregateWriteResult, error) {
	r.saveCalls++
	return nil, nil
}

func TestProductAggregateReplayDoesNotDependOnStagedMedia(t *testing.T) {
	want := &Product{ID: 17, Title: "Already committed"}
	repo := &aggregateReplayRepository{
		result: &ProductAggregateWriteResult{Product: want, Replayed: true},
	}
	key := "uploads/no-longer-present.webp"
	service := NewService(repo, nil, nil)

	got, err := service.SaveAggregate(context.Background(), 0, SaveProductAggregateReq{
		OperationID: uuid.NewString(),
		Title:       "Already committed",
		Images: []SaveProductImageReq{{
			StorageKey: &key,
			IsPrimary:  true,
		}},
	})
	if err != nil || got != want {
		t.Fatalf("replayed aggregate = %+v, %v; want %+v", got, err, want)
	}
	if repo.findCalls != 1 || repo.saveCalls != 0 {
		t.Fatalf("repository calls = find %d/save %d; want 1/0", repo.findCalls, repo.saveCalls)
	}
}

func TestNormalizeAndValidateProductAggregateSlugifiesAndRequiresActiveSlug(t *testing.T) {
	raw := "  Highland / Single--Malt?  "
	req := SaveProductAggregateReq{
		OperationID: uuid.NewString(),
		Title:       "Highland Single Malt",
		Slug:        &raw,
		IsActive:    true,
	}

	if fields := normalizeAndValidateProductAggregate(0, &req); len(fields) > 0 {
		t.Fatalf("valid active slug fields = %#v", fields)
	}
	if req.Slug == nil || *req.Slug != "highland-single-malt" {
		t.Fatalf("slug = %#v; want highland-single-malt", req.Slug)
	}

	draft := SaveProductAggregateReq{
		OperationID: uuid.NewString(),
		Title:       "Draft",
		IsActive:    false,
	}
	if fields := normalizeAndValidateProductAggregate(0, &draft); len(fields) > 0 {
		t.Fatalf("inactive without slug fields = %#v", fields)
	}
	if draft.Slug != nil {
		t.Fatalf("draft slug = %#v; want nil", draft.Slug)
	}

	draft.Variants = []SaveProductVariantReq{{Price: 0, IsActive: true}}
	if fields := normalizeAndValidateProductAggregate(0, &draft); len(fields) > 0 {
		t.Fatalf("inactive unpriced variant fields = %#v", fields)
	}
	draft.IsActive = true
	if fields := normalizeAndValidateProductAggregate(0, &draft); len(fields["variants.0.price"]) == 0 {
		t.Fatalf("active unpriced variant fields = %#v", fields)
	}

	active := SaveProductAggregateReq{
		OperationID: uuid.NewString(),
		Title:       "Live",
		IsActive:    true,
	}
	fields := normalizeAndValidateProductAggregate(0, &active)
	if len(fields["slug"]) == 0 || fields["slug"][0] != errMsgActiveProductNeedsSlug {
		t.Fatalf("active without slug fields = %#v", fields)
	}

	garbage := "---"
	invalid := SaveProductAggregateReq{
		OperationID: uuid.NewString(),
		Title:       "Live",
		Slug:        &garbage,
		IsActive:    true,
	}
	fields = normalizeAndValidateProductAggregate(0, &invalid)
	if !containsSlugMessage(fields["slug"], errMsgInvalidPublicSlug) ||
		!containsSlugMessage(fields["slug"], errMsgActiveProductNeedsSlug) {
		t.Fatalf("invalid active slug fields = %#v", fields)
	}
}

func containsSlugMessage(messages []string, want string) bool {
	for _, message := range messages {
		if message == want {
			return true
		}
	}
	return false
}
