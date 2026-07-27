package services

import (
	"context"
	"errors"
	"testing"

	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/pkg/apperr"
)

type optionServiceRepo struct {
	repositories.OptionRepository
	typeReq        models.CreateOptionTypeReq
	valueReq       models.CreateOptionValueReq
	valueTypeID    int64
	typeValue      *models.OptionType
	createTypeErr  error
	deleteTypeErr  error
	deleteValueErr error
}

func (r *optionServiceRepo) CreateType(_ context.Context, req models.CreateOptionTypeReq) (*models.OptionType, error) {
	r.typeReq = req
	if r.createTypeErr != nil {
		return nil, r.createTypeErr
	}
	return &models.OptionType{ID: 1, Title: req.Title, DisplayName: req.DisplayName}, nil
}

func (r *optionServiceRepo) GetType(context.Context, int64) (*models.OptionType, error) {
	if r.typeValue == nil {
		return nil, models.ErrNotFound
	}
	return r.typeValue, nil
}

func (r *optionServiceRepo) CreateValue(_ context.Context, optionTypeID int64, req models.CreateOptionValueReq) (*models.OptionValue, error) {
	r.valueTypeID = optionTypeID
	r.valueReq = req
	return &models.OptionValue{ID: 2, OptionTypeID: optionTypeID, Value: req.Value, SortOrder: req.SortOrder}, nil
}

func (r *optionServiceRepo) DeleteType(context.Context, int64) error {
	return r.deleteTypeErr
}

func (r *optionServiceRepo) DeleteValue(context.Context, int64) error {
	return r.deleteValueErr
}

func TestOptionServiceNormalizesTypeAndValueWrites(t *testing.T) {
	repo := &optionServiceRepo{typeValue: &models.OptionType{ID: 4, Title: "volume", DisplayName: "Volume"}}
	service := NewOptionService(repo)

	optionType, err := service.CreateType(context.Background(), models.CreateOptionTypeReq{
		Title: "  volume ", DisplayName: " Volume  ",
	})
	if err != nil || optionType.Title != "volume" || optionType.DisplayName != "Volume" {
		t.Fatalf("create type = %+v, %v", optionType, err)
	}
	value, err := service.CreateValue(context.Background(), 4, models.CreateOptionValueReq{
		Value: " 750 ml ", SortOrder: 2,
	})
	if err != nil || value.Value != "750 ml" || repo.valueTypeID != 4 {
		t.Fatalf("create value = %+v, %v, type %d", value, err, repo.valueTypeID)
	}
	if repo.typeReq.Title != "volume" || repo.valueReq.Value != "750 ml" {
		t.Fatalf("normalized requests = type %+v, value %+v", repo.typeReq, repo.valueReq)
	}
}

func TestOptionServiceRejectsBlankAndInvalidWrites(t *testing.T) {
	service := NewOptionService(&optionServiceRepo{})
	if _, err := service.CreateType(context.Background(), models.CreateOptionTypeReq{
		Title: " ", DisplayName: "Size",
	}); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("blank type error = %v; want invalid request", err)
	}
	if _, err := service.CreateValue(context.Background(), 1, models.CreateOptionValueReq{
		Value: "Size", SortOrder: -1,
	}); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("negative sort error = %v; want invalid request", err)
	}
}

func TestOptionServiceMapsUniquenessAndReferenceConflicts(t *testing.T) {
	repo := &optionServiceRepo{
		createTypeErr:  models.ErrConflict,
		deleteTypeErr:  models.ErrConflict,
		deleteValueErr: models.ErrConflict,
	}
	service := NewOptionService(repo)

	if _, err := service.CreateType(context.Background(), models.CreateOptionTypeReq{
		Title: "size", DisplayName: "Size",
	}); !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("create conflict = %v", err)
	}
	if err := service.DeleteType(context.Background(), 1); !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("type reference conflict = %v", err)
	}
	if err := service.DeleteValue(context.Background(), 1); !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("value reference conflict = %v", err)
	}
}
