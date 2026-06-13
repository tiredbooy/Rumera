package services

import (
	"context"
	"fmt"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
)

type AddressService interface {
	Create(ctx context.Context, userID int64, req models.CreateAddressReq) (*models.Address, error)
	GetByID(ctx context.Context, id int64, userID int64) (*models.Address, error)
	GetAllByUserID(ctx context.Context, userID int64) ([]*models.Address, error)
	Update(ctx context.Context, id int64, userID int64, req models.UpdateAddressReq) (*models.Address, error)
	Delete(ctx context.Context, id int64, userID int64) error
	SetDefault(ctx context.Context, id int64, userID int64) error
}

type addressService struct {
	repo repositories.AddressRepository
}

func NewAddressService(repo repositories.AddressRepository) AddressService {
	return &addressService{repo: repo}
}

func (s *addressService) Create(ctx context.Context, userID int64, req models.CreateAddressReq) (*models.Address, error) {
	address, err := s.repo.Create(ctx, userID, req)
	if err != nil {
		return nil, fmt.Errorf("addressService.Create: %w", err)
	}
	return address, nil
}

func (s *addressService) GetByID(ctx context.Context, id int64, userID int64) (*models.Address, error) {
	address, err := s.repo.GetByID(ctx, id, userID)
	if err != nil {
		return nil, fmt.Errorf("addressService.GetByID: %w", err)
	}
	return address, nil
}

func (s *addressService) GetAllByUserID(ctx context.Context, userID int64) ([]*models.Address, error) {
	addresses, err := s.repo.GetAllByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("addressService.GetAllByUserID: %w", err)
	}
	return addresses, nil
}

func (s *addressService) Update(ctx context.Context, id int64, userID int64, req models.UpdateAddressReq) (*models.Address, error) {
	address, err := s.repo.Update(ctx, id, userID, req)
	if err != nil {
		return nil, fmt.Errorf("addressService.Update: %w", err)
	}
	return address, nil
}

func (s *addressService) Delete(ctx context.Context, id int64, userID int64) error {
	if err := s.repo.Delete(ctx, id, userID); err != nil {
		return fmt.Errorf("addressService.Delete: %w", err)
	}
	return nil
}

func (s *addressService) SetDefault(ctx context.Context, id int64, userID int64) error {
	if err := s.repo.SetDefault(ctx, id, userID); err != nil {
		return fmt.Errorf("addressService.SetDefault: %w", err)
	}
	return nil
}
