package hero

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/pkg/validator"
)

// New wires repository → service → HTTP handler for hero slides.
func New(db *pgxpool.Pool, media MediaCleaner, v *validator.Validator) *Handler {
	return NewHandler(NewService(NewRepository(db), media), v)
}
