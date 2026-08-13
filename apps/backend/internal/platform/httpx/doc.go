// Package httpx holds shared HTTP helpers used by feature handlers:
// JSON/query binding, path params, identity extraction, pagination helpers,
// and domain-error mapping.
//
// Feature handlers should depend on this package instead of copying bind helpers.
// Cross-cutting auth middleware stays in internal/middlewares.
//
// Typical use from a feature Handler that embeds a Validator:
//
//	if !httpx.BindJSON(c, h.Validator, &req) { return }
//	id, ok := httpx.ParamInt64(c, "id")
package httpx
