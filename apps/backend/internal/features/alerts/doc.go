// Package alerts is the vertical slice for product back-in-stock / price-drop alerts.
// Service uses variant.Repository + inventory.Repository (until catalog migrates).
// Restock create fails closed when the inventory row is missing (PR-053c).
// PR-055a: cron prefers notifications.Dispatcher (ProductAlertNotifier) when
// wired; EmailCopy owns the Persian restock / price-drop body.
// Read: doc.go → routes.go → handler.go → service.go → repository.go
package alerts
