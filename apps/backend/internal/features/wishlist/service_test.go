package wishlist

import (
	"context"
	"testing"

	"github.com/tiredbooy/pkg/apperr"
)

type repoStub struct {
	Repository
	wishlist *Wishlist
}

func (s *repoStub) GetOrCreate(_ context.Context, userID int64) (*Wishlist, error) {
	if s.wishlist == nil {
		s.wishlist = &Wishlist{ID: 7, UserID: userID}
	}
	return s.wishlist, nil
}

func (s *repoStub) GetItems(context.Context, int64) ([]ItemResponse, error) {
	return []ItemResponse{}, nil
}

func (s *repoStub) AddItem(context.Context, int64, AddItemReq) error { return nil }

func TestServiceGetOrCreateRejectsZeroUser(t *testing.T) {
	svc := NewService(&repoStub{})
	_, err := svc.GetOrCreate(context.Background(), 0)
	if err != apperr.ErrAccessDenied {
		t.Fatalf("err = %v; want ErrAccessDenied", err)
	}
}

func TestServiceGetOrCreateOK(t *testing.T) {
	svc := NewService(&repoStub{})
	w, err := svc.GetOrCreate(context.Background(), 3)
	if err != nil || w.ID != 7 || w.UserID != 3 {
		t.Fatalf("got %+v err=%v", w, err)
	}
}

func TestToResponseEmptyItems(t *testing.T) {
	r := ToResponse(&Wishlist{ID: 1}, nil)
	if r.Total != 0 || r.Items == nil {
		t.Fatalf("response = %+v", r)
	}
}
