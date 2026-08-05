package main

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/internal/services"
)

// seedOptionCatalog creates reusable option types (volume, …) once so product
// variants can pick shared values without redefining them per product.
func (s *seeder) seedOptionCatalog(ctx context.Context) error {
	optionSvc := services.NewOptionService(repositories.NewOptionRepository(s.pool))

	type valueSpec struct {
		value string
		order int
	}
	type typeSpec struct {
		title       string
		displayName string
		values      []valueSpec
	}

	specs := []typeSpec{
		{
			title:       "volume",
			displayName: "حجم",
			values: []valueSpec{
				{value: "۵۰ میلی‌لیتر", order: 0},
				{value: "۲۰۰ میلی‌لیتر", order: 1},
				{value: "۳۷۵ میلی‌لیتر", order: 2},
				{value: "۷۰۰ میلی‌لیتر", order: 3},
				{value: "۷۵۰ میلی‌لیتر", order: 4},
				{value: "۱ لیتر", order: 5},
			},
		},
		{
			title:       "pack",
			displayName: "بسته",
			values: []valueSpec{
				{value: "تک‌بطری", order: 0},
				{value: "بسته ۶ تایی", order: 1},
				{value: "بسته ۱۲ تایی", order: 2},
			},
		},
	}

	for _, spec := range specs {
		existing, err := s.findOptionTypeID(ctx, spec.title)
		if err != nil {
			return err
		}
		var typeID int64
		if existing > 0 {
			typeID = existing
			s.c.skipped1("option_type")
		} else {
			created, err := optionSvc.CreateType(ctx, models.CreateOptionTypeReq{
				Title:       spec.title,
				DisplayName: spec.displayName,
			})
			if err != nil {
				return fmt.Errorf("create option type %q: %w", spec.title, err)
			}
			typeID = created.ID
			s.c.created1("option_type")
		}

		for _, val := range spec.values {
			has, err := s.hasOptionValue(ctx, typeID, val.value)
			if err != nil {
				return err
			}
			if has {
				s.c.skipped1("option_value")
				continue
			}
			if _, err := optionSvc.CreateValue(ctx, typeID, models.CreateOptionValueReq{
				Value:     val.value,
				SortOrder: val.order,
			}); err != nil {
				return fmt.Errorf("create option value %q/%q: %w", spec.title, val.value, err)
			}
			s.c.created1("option_value")
		}
	}
	return nil
}

func (s *seeder) findOptionTypeID(ctx context.Context, title string) (int64, error) {
	var id int64
	err := s.pool.QueryRow(ctx,
		`SELECT id FROM option_types WHERE title = $1 LIMIT 1`, title,
	).Scan(&id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, nil
		}
		return 0, err
	}
	return id, nil
}

func (s *seeder) hasOptionValue(ctx context.Context, typeID int64, value string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS(
			SELECT 1 FROM option_values
			WHERE option_type_id = $1 AND value = $2
		)`, typeID, value,
	).Scan(&exists)
	return exists, err
}
