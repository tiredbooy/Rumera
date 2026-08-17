package product

import (
	"context"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/internal/analytics"
	"github.com/tiredbooy/internal/middlewares"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/platform/httpx"
	"github.com/tiredbooy/pkg/cache"
	"github.com/tiredbooy/pkg/response"
	"github.com/tiredbooy/pkg/validator"
	"go.uber.org/zap"
	"golang.org/x/sync/singleflight"
)

// productCacheTTL bounds how stale a cached product detail can be. Direct
// product writes invalidate eagerly; inventory/price shifts surface within
// this window via response.CachedJSON max-age.
const productCacheTTL = 60 * time.Second

// Handler is the HTTP surface for catalogue products.
type Handler struct {
	Product   *Service
	Validator *validator.Validator
	Cache     cache.Store
	Log       *zap.Logger

	cacheGroup singleflight.Group
}

// NewHandler constructs the product HTTP handler.
func NewHandler(svc *Service, v *validator.Validator, store cache.Store, log *zap.Logger) *Handler {
	return &Handler{Product: svc, Validator: v, Cache: store, Log: log}
}

type tagIDsReq struct {
	TagIDs []int64 `json:"tag_ids" validate:"required"`
}

// CreateProduct — POST /admin/products
//
// Returns the fully-hydrated ProductDetail (not the raw DB model) so the
// response carries the REST `json` field names the storefront/admin clients
// expect — most importantly a lowercase `id`, which the create form needs to
// upload images and navigate to the new product.
func (h *Handler) CreateProduct(c *gin.Context) {
	var req CreateProductReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	ctx := c.Request.Context()
	product, err := h.Product.Create(ctx, req)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	detail, err := h.buildAdminProductDetail(ctx, product.ID)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Created(c, detail)
}

// ListProducts — GET /products (public; active products only)
func (h *Handler) ListProducts(c *gin.Context) {
	var filter ProductFilter
	if !httpx.BindQuery(c, h.Validator, &filter) {
		return
	}
	filter.Defaults()
	// CF-2: a non-numeric id is a 400, not an empty page that reads as "no such
	// products". Checked on both lists — they share ProductFilter.
	if _, err := filter.ValidIDs(); err != nil {
		httpx.HandleError(c, err)
		return
	}
	// The storefront must never surface inactive/draft products — force the
	// filter regardless of any client-supplied is_active value.
	active := true
	filter.IsActive = &active

	items, total, err := h.Product.GetAll(c.Request.Context(), filter)
	if err != nil {
		// Fail the request. Do not invent an empty page or results_count=0.
		httpx.HandleError(c, err)
		return
	}
	// Storefront search is GET /products?search= (there is no GET /search).
	if q := strings.TrimSpace(filter.Search); q != "" {
		c.Set(middlewares.AnalyticsPayloadKey, analytics.SearchPayload(q, total))
	}
	response.Paginated(c, items, httpx.Paginate(filter.Page, filter.Limit, total))
}

// ListAdminProducts — GET /admin/products (staff; includes inactive products).
// Same projection as the public list (brand + price band) but unfiltered by
// status so the admin catalogue can manage drafts; honors an explicit
// ?is_active= filter when provided.
func (h *Handler) ListAdminProducts(c *gin.Context) {
	var filter ProductFilter
	if !httpx.BindQuery(c, h.Validator, &filter) {
		return
	}
	filter.Defaults()
	// CF-2: a non-numeric id is a 400, not an empty page that reads as "no such
	// products". Checked on both lists — they share ProductFilter.
	if _, err := filter.ValidIDs(); err != nil {
		httpx.HandleError(c, err)
		return
	}

	items, total, err := h.Product.GetAll(c.Request.Context(), filter)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.Paginated(c, items, httpx.Paginate(filter.Page, filter.Limit, total))
}

// productCacheTTL bounds how stale a cached product detail can be. Direct
// product writes invalidate eagerly; variant/stock changes are reflected within
// this window.

// GetProduct returns a fully-hydrated product (tags, images, variants). The
// response is served read-through from Redis to absorb catalogue read traffic.
//
// GET /products/:id
func (h *Handler) GetProduct(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	ctx := c.Request.Context()

	data, err := h.cachedJSON(ctx, cache.KeyProduct(id), productCacheTTL, func() (any, error) {
		return h.buildProductDetail(ctx, id)
	})
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	// Catalog BIGINT for analytics product_viewed payloads.
	c.Set(middlewares.AnalyticsProductIDKey, id)
	response.CachedJSON(c, data, productCacheTTL)
}

// GetProductBySlug resolves an exact active slug, then shares the hydrated ID
// cache with GetProduct so both public identities have the same staleness bound.
//
// GET /products/slug/:slug
func (h *Handler) GetProductBySlug(c *gin.Context) {
	ctx := c.Request.Context()
	product, err := h.Product.GetBySlug(ctx, c.Param("slug"))
	if err != nil {
		httpx.HandleError(c, err)
		return
	}

	data, err := h.cachedJSON(ctx, cache.KeyProduct(product.ID), productCacheTTL, func() (any, error) {
		return h.buildProductDetail(ctx, product.ID)
	})
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	c.Set(middlewares.AnalyticsProductIDKey, product.ID)
	response.CachedJSON(c, data, productCacheTTL)
}

// GetAdminProduct returns the hydrated editable projection without applying the
// public is_active filter. It is intentionally not stored in the public cache.
func (h *Handler) GetAdminProduct(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	detail, err := h.buildAdminProductDetail(c.Request.Context(), id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, detail)
}

// buildProductDetail assembles the hydrated product view from the service layer.
func (h *Handler) buildProductDetail(ctx context.Context, id int64) (*models.ProductDetail, error) {
	return h.buildProductDetailWith(ctx, id, h.Product.GetByID)
}

func (h *Handler) buildAdminProductDetail(ctx context.Context, id int64) (*models.ProductDetail, error) {
	return h.buildProductDetailWith(ctx, id, h.Product.GetByIDForAdmin)
}

func (h *Handler) buildProductDetailWith(
	ctx context.Context,
	id int64,
	getProduct func(context.Context, int64) (*Product, error),
) (*models.ProductDetail, error) {
	product, err := getProduct(ctx, id)
	if err != nil {
		return nil, err
	}
	tags, err := h.Product.GetTags(ctx, id)
	if err != nil {
		return nil, err
	}
	images, err := h.Product.GetImages(ctx, id)
	if err != nil {
		return nil, err
	}
	variants, err := h.Product.GetVariants(ctx, id)
	if err != nil {
		return nil, err
	}
	variantOptions, err := h.Product.GetVariantOptions(ctx, id)
	if err != nil {
		return nil, err
	}
	variantImages, err := h.Product.GetVariantImages(ctx, id)
	if err != nil {
		return nil, err
	}
	availableStock, err := h.Product.GetVariantAvailableStock(ctx, id)
	if err != nil {
		return nil, err
	}

	tagResp := make([]models.TagResponse, len(tags))
	for i, t := range tags {
		tagResp[i] = ToTagResponse(t)
	}
	imgResp := make([]models.ImageResponse, len(images))
	for i, img := range images {
		imgResp[i] = ToImageResponse(img)
	}
	varResp := make([]models.VariantResponse, len(variants))
	for i, v := range variants {
		stock := availableStock[v.ID]
		images := variantImages[v.ID]
		imageResponses := make([]models.ImageResponse, len(images))
		for imageIndex, image := range images {
			imageResponses[imageIndex] = ToImageResponse(image)
		}
		varResp[i] = ToVariantResponse(
			v,
			variantOptions[v.ID],
			imageResponses,
			&stock,
		)
	}

	return ToProductDetail(product, tagResp, imgResp, varResp), nil
}

// UpdateProduct — PATCH /admin/products/:id
func (h *Handler) UpdateProduct(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var req UpdateProductReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	ctx := c.Request.Context()
	if _, err := h.Product.Update(ctx, id, req); err != nil {
		httpx.HandleError(c, err)
		return
	}
	h.invalidate(ctx, cache.KeyProduct(id))
	// Re-hydrate so the response matches GetProduct (REST json field names,
	// fresh tags/images/variants) rather than the raw DB model.
	detail, err := h.buildAdminProductDetail(ctx, id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	response.OK(c, detail)
}

// DeleteProduct — DELETE /admin/products/:id
func (h *Handler) DeleteProduct(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	if err := h.Product.Delete(c.Request.Context(), id); err != nil {
		httpx.HandleError(c, err)
		return
	}
	h.invalidate(c.Request.Context(), cache.KeyProduct(id))
	response.NoContent(c)
}

// ProductTags — GET /products/:id/tags
func (h *Handler) ProductTags(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	if _, err := h.Product.GetByID(c.Request.Context(), id); err != nil {
		httpx.HandleError(c, err)
		return
	}
	tags, err := h.Product.GetTags(c.Request.Context(), id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	out := make([]models.TagResponse, len(tags))
	for i, t := range tags {
		out[i] = ToTagResponse(t)
	}
	response.OK(c, out)
}

// ProductImages — GET /products/:id/images
func (h *Handler) ProductImages(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	if _, err := h.Product.GetByID(c.Request.Context(), id); err != nil {
		httpx.HandleError(c, err)
		return
	}
	images, err := h.Product.GetImages(c.Request.Context(), id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	out := make([]models.ImageResponse, len(images))
	for i, img := range images {
		out[i] = ToImageResponse(img)
	}
	response.OK(c, out)
}

// ProductVariants — GET /products/:id/variants
func (h *Handler) ProductVariants(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	if _, err := h.Product.GetByID(c.Request.Context(), id); err != nil {
		httpx.HandleError(c, err)
		return
	}
	variants, err := h.Product.GetVariants(c.Request.Context(), id)
	if err != nil {
		httpx.HandleError(c, err)
		return
	}
	out := make([]models.VariantResponse, len(variants))
	for i, v := range variants {
		out[i] = ToVariantResponse(v, nil, nil, nil)
	}
	response.OK(c, out)
}

// SyncProductTags replaces a product's tag set — PUT /admin/products/:id/tags
func (h *Handler) SyncProductTags(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var req tagIDsReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	if err := h.Product.SyncTags(c.Request.Context(), id, req.TagIDs); err != nil {
		httpx.HandleError(c, err)
		return
	}
	h.invalidate(c.Request.Context(), cache.KeyProduct(id))
	response.NoContent(c)
}

// AttachProductTags — POST /admin/products/:id/tags
func (h *Handler) AttachProductTags(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var req tagIDsReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	if err := h.Product.AttachTags(c.Request.Context(), id, req.TagIDs); err != nil {
		httpx.HandleError(c, err)
		return
	}
	h.invalidate(c.Request.Context(), cache.KeyProduct(id))
	response.NoContent(c)
}

// DetachProductTags — DELETE /admin/products/:id/tags
func (h *Handler) DetachProductTags(c *gin.Context) {
	id, ok := httpx.ParamInt64(c, "id")
	if !ok {
		return
	}
	var req tagIDsReq
	if !httpx.BindJSON(c, h.Validator, &req) {
		return
	}
	if err := h.Product.DetachTags(c.Request.Context(), id, req.TagIDs); err != nil {
		httpx.HandleError(c, err)
		return
	}
	h.invalidate(c.Request.Context(), cache.KeyProduct(id))
	response.NoContent(c)
}
