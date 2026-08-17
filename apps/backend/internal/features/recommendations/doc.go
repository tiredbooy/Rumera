// Package recommendations is the vertical slice for product recommendations
// (trending, similar, FBT, for-you profiles, interactions, admin ops stats).
//
// Ownership: model, repository, service, handler, routes.
// Cron profile refresh (internal/corn) depends on Service.RefreshActiveProfiles.
// ForYou reads taste.Service at serve time (wired in New); it does not persist
// quiz prefs into user_recommendation_profiles.
// payments.Confirm records purchase via RecordPurchasesForOrder; cart.AddItem
// records add_to_cart via RecordInteraction. Unknown product_id is 404.
//
// Read order: doc.go → routes.go → handler.go → service.go → blend.go → repository.go → model.go.
//
// See refactor-workstreams/backend-feature-architecture/CHARTER.md.
package recommendations
