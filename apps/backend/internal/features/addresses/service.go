package addresses

import (
	"context"
	"fmt"
	"strings"
)

// countryToISO folds a country as typed by any address writer onto the ISO 3166-1
// alpha-2 code the shipping lookup matches on. shipping_zones.region_codes holds
// uppercase codes and zone_repository.go compares them literally, so a country that
// is not already a code silently quotes zero shipping methods at checkout rather
// than erroring — normalising here keeps every writer honest at the one boundary
// they all pass through.
func countryToISO(v string) string {
	c := strings.ToUpper(strings.TrimSpace(v))
	switch c {
	case "ایران", "IRAN", "IRN":
		return "IR"
	}
	return c
}

type Service interface {
	Create(ctx context.Context, userID int64, req CreateAddressReq) (*Address, error)
	GetByID(ctx context.Context, id int64, userID int64) (*Address, error)
	GetAllByUserID(ctx context.Context, userID int64) ([]*Address, error)
	Update(ctx context.Context, id int64, userID int64, req UpdateAddressReq) (*Address, error)
	Delete(ctx context.Context, id int64, userID int64) error
	SetDefault(ctx context.Context, id int64, userID int64) error
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return &service{repo: repo}
}

func (s *service) Create(ctx context.Context, userID int64, req CreateAddressReq) (*Address, error) {
	req.Country = countryToISO(req.Country)
	address, err := s.repo.Create(ctx, userID, req)
	if err != nil {
		return nil, fmt.Errorf("service.Create: %w", err)
	}
	return address, nil
}

func (s *service) GetByID(ctx context.Context, id int64, userID int64) (*Address, error) {
	address, err := s.repo.GetByID(ctx, id, userID)
	if err != nil {
		return nil, fmt.Errorf("service.GetByID: %w", err)
	}
	return address, nil
}

func (s *service) GetAllByUserID(ctx context.Context, userID int64) ([]*Address, error) {
	addresses, err := s.repo.GetAllByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("service.GetAllByUserID: %w", err)
	}
	return addresses, nil
}

func (s *service) Update(ctx context.Context, id int64, userID int64, req UpdateAddressReq) (*Address, error) {
	if req.Country != nil {
		c := countryToISO(*req.Country)
		req.Country = &c
	}
	address, err := s.repo.Update(ctx, id, userID, req)
	if err != nil {
		return nil, fmt.Errorf("service.Update: %w", err)
	}
	return address, nil
}

func (s *service) Delete(ctx context.Context, id int64, userID int64) error {
	if err := s.repo.Delete(ctx, id, userID); err != nil {
		return fmt.Errorf("service.Delete: %w", err)
	}
	return nil
}

func (s *service) SetDefault(ctx context.Context, id int64, userID int64) error {
	if err := s.repo.SetDefault(ctx, id, userID); err != nil {
		return fmt.Errorf("service.SetDefault: %w", err)
	}
	return nil
}
