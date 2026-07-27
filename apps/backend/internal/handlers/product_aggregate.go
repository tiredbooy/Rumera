package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/response"
)

// CreateProductAggregate persists the complete editor snapshot atomically.
func (h *Handler) CreateProductAggregate(c *gin.Context) {
	h.saveProductAggregate(c, 0, http.StatusCreated)
}

// UpdateProductAggregate replaces the complete editor-owned product graph under
// an optimistic revision check.
func (h *Handler) UpdateProductAggregate(c *gin.Context) {
	productID, ok := h.paramInt64(c, "id")
	if !ok {
		return
	}
	h.saveProductAggregate(c, productID, http.StatusOK)
}

func (h *Handler) saveProductAggregate(c *gin.Context, productID int64, status int) {
	var req models.SaveProductAggregateReq
	if !h.bindJSON(c, &req) {
		return
	}
	ctx := c.Request.Context()
	product, err := h.Product.SaveAggregate(ctx, productID, req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	h.invalidate(ctx, cache.KeyProduct(product.ID))
	detail, err := h.buildAdminProductDetail(ctx, product.ID)
	if err != nil {
		h.handleError(c, err)
		return
	}
	if status == http.StatusCreated {
		response.Created(c, detail)
		return
	}
	response.OK(c, detail)
}
