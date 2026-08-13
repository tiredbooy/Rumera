package addresses

import (
	"context"
	"errors"
	"testing"

	"github.com/tiredbooy/internal/models"
)

type repoStub struct {
	Repository
	created *Address
	err     error
}

func (s *repoStub) Create(_ context.Context, userID int64, req CreateAddressReq) (*Address, error) {
	if s.err != nil {
		return nil, s.err
	}
	s.created = &Address{ID: 1, UserID: userID, FullName: req.FullName, City: req.City, Country: req.Country}
	return s.created, nil
}

func (s *repoStub) GetByID(context.Context, int64, int64) (*Address, error) {
	return nil, models.ErrNotFound
}

func TestServiceCreatePassesThrough(t *testing.T) {
	stub := &repoStub{}
	svc := NewService(stub)
	addr, err := svc.Create(context.Background(), 9, CreateAddressReq{
		FullName: "Ali", AddressLine1: "x", City: "Tehran", PostalCode: "1", Country: "IR",
	})
	if err != nil {
		t.Fatal(err)
	}
	if addr.UserID != 9 || addr.FullName != "Ali" {
		t.Fatalf("got %+v", addr)
	}
}

func TestServiceCreateWrapsError(t *testing.T) {
	stub := &repoStub{err: errors.New("db down")}
	svc := NewService(stub)
	_, err := svc.Create(context.Background(), 1, CreateAddressReq{FullName: "x", AddressLine1: "a", City: "c", PostalCode: "p", Country: "IR"})
	if err == nil {
		t.Fatal("expected error")
	}
}
