package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Pagination struct {
	Page       int  `json:"page"`
	Limit      int  `json:"limit"`
	TotalItems int  `json:"total_items"`
	TotalPages int  `json:"total_pages"`
	HasNext    bool `json:"has_next"`
	HasPrev    bool `json:"has_prev"`
}

type PaginatedResponse[T any] struct {
	Results    []T        `json:"results"`
	Pagination Pagination `json:"pagination"`
}

func NewPagination(page, limit, totalItems int) Pagination {
	totalPages := totalItems / limit
	if totalItems%limit != 0 {
		totalPages++
	}
	if totalPages == 0 {
		totalPages = 1
	}

	return Pagination{
		Page:       page,
		Limit:      limit,
		TotalItems: totalItems,
		TotalPages: totalPages,
		HasNext:    page < totalPages,
		HasPrev:    page > 1,
	}
}

func Paginated[T any](c *gin.Context, results []T, pagination Pagination) {
	if results == nil {
		results = []T{}
	}
	c.JSON(http.StatusOK, PaginatedResponse[T]{
		Results:    results,
		Pagination: pagination,
	})
}
