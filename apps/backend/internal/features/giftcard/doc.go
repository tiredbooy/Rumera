// Package giftcard is the vertical slice for gift-card issue, paid purchase
// fulfill, redeem, and admin list/void. Redeem credits wallet inside a
// repository transaction. A successful new paid issue emails the code
// (PR-005b); replay does not. Staff list/void use gift-cards:issue (PR-056a).
// Read: doc.go → routes.go → handler.go → service.go → repository.go
package giftcard
