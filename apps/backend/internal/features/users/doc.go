// Package users is the vertical slice for accounts, profile, and admin user ops.
//
// Ownership:
//   - model.go       — User, AuthUser, admin DTOs, role constants
//   - repository.go  — users table + admin audit
//   - service.go     — registration rules, admin self-lockout, role summary
//   - mapper.go      — request/response projection
//   - handler.go     — HTTP handlers
//   - routes.go      — RegisterPublic / RegisterCustomer / RegisterAdmin
//
// Auth (login, OTP, JWT) lives in features/auth and calls this package's Service.
// Middleware AuthUserReader is satisfied by Service.GetAuthUserByUID.
//
// Read order: doc.go → routes.go → handler.go → service.go → repository.go → model.go.
//
// See refactor-workstreams/backend-feature-architecture/CHARTER.md.
package users
