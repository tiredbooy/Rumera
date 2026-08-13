package addresses

import (
	"context"
	"fmt"

		)

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
