package reviews

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/pkg/validator"
)

// New wires repositories → service → HTTP handler for the reviews feature.
// loyalty may be nil (tests); production passes *loyalty.Service for PH-040b earn.
func New(db *pgxpool.Pool, v *validator.Validator, loyalty reviewLoyalty) *Handler {
	svc := NewService(NewRepository(db), NewImageRepository(db), loyalty)
	return NewHandler(svc, v)
}
