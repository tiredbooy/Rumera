// Package auth is the vertical slice for authentication and session lifecycle.
//
// Ownership:
//   - handler.go / otp.go / tokens.go — login, register, OTP, refresh, logout, /me
//   - password_reset_* — forgot/reset token flow
//   - routes.go — RegisterPublic / RegisterCustomer / RegisterAdmin
//
// Depends on features/users for account CRUD and AuthUser rehydration.
// JWT issue/parse stays in pkg/token; refresh whitelist uses pkg/cache.
//
// Read order: doc.go → routes.go → handler.go → tokens.go → password_reset_service.go.
//
// See refactor-workstreams/backend-feature-architecture/CHARTER.md.
package auth
