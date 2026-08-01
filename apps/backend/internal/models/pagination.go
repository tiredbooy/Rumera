package models

type PaginationParams struct {
	Page  int
	Limit int
}

// Offset calculates the DB offset so you never repeat this math in every repo
func (p PaginationParams) Offset() int {
	return (p.Page - 1) * p.Limit
}
