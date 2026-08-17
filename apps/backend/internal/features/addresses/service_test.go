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
	updated *UpdateAddressReq
	err     error
}

func (s *repoStub) Update(_ context.Context, id int64, userID int64, req UpdateAddressReq) (*Address, error) {
	if s.err != nil {
		return nil, s.err
	}
	s.updated = &req
	return &Address{ID: id, UserID: userID}, nil
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

// P0-1: the account address form wrote "ایران"; shipping zones match uppercase ISO
// codes, so an un-normalised country quotes zero shipping methods at checkout.
func TestServiceCreateNormalizesCountryToISO(t *testing.T) {
	for _, in := range []string{"ایران", " ایران ", "IR", "ir", "Iran", "irn"} {
		stub := &repoStub{}
		addr, err := NewService(stub).Create(context.Background(), 1, CreateAddressReq{
			FullName: "Ali", AddressLine1: "x", City: "Tehran", PostalCode: "1", Country: in,
		})
		if err != nil {
			t.Fatalf("%q: %v", in, err)
		}
		if addr.Country != "IR" {
			t.Fatalf("Create(%q) stored country %q, want \"IR\"", in, addr.Country)
		}
	}
}

func TestServiceUpdateNormalizesCountryToISO(t *testing.T) {
	stub := &repoStub{}
	in := "ایران"
	req := UpdateAddressReq{Country: &in}
	if _, err := NewService(stub).Update(context.Background(), 1, 1, req); err != nil {
		t.Fatal(err)
	}
	if stub.updated == nil || stub.updated.Country == nil || *stub.updated.Country != "IR" {
		t.Fatalf("Update did not normalise country: %+v", stub.updated)
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
