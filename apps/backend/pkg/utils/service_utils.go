package utils

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/tiredbooy/internal/models"
)

func RollbackOnErr(ctx context.Context, tx pgx.Tx, err *error) {
	if *err != nil {
		_ = tx.Rollback(ctx)
	}
}

func IsNotFound(err error) bool {
	return errors.Is(err, models.ErrNotFound)
}

func IsInsufficientFunds(err error) bool {
	return errors.Is(err, models.ErrInsufficientFunds)
}
