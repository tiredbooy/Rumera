package httpx

import "github.com/tiredbooy/pkg/response"

// Paginate maps a (page, limit, total) tuple to the response.Pagination envelope.
func Paginate(page, limit int, total int64) response.Pagination {
	if limit <= 0 {
		limit = 1
	}
	return response.NewPagination(page, limit, int(total))
}
