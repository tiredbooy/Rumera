package blog

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/pkg/validator"
)

// New wires post + category repositories → services → HTTP handler.
func New(db *pgxpool.Pool, media MediaCleaner, v *validator.Validator) *Handler {
	posts := NewService(NewRepository(db), db, media)
	cats := NewCategoryService(NewCategoryRepository(db))
	return NewHandler(posts, cats, v)
}
