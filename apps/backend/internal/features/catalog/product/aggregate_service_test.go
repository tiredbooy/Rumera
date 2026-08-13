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
