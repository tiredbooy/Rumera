package tag

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/pkg/validator"
)

// New wires repository → service → HTTP handler for the tag feature.
func New(db *pgxpool.Pool, v *validator.Validator) *Handler {
	return NewHandler(NewService(NewRepository(db)), v)
}
