// Package rbac is the vertical slice for panel roles and capabilities.
//
// Ownership:
//   - model.go      — permission catalogue, RoleCapabilities
//   - repository.go — role_capabilities table access
//   - service.go    — admin superuser + staff fail-closed rules
//   - handler.go    — HTTP handlers
//   - routes.go     — RegisterPublic / RegisterCustomer / RegisterAdmin
//
// Read order for newcomers: doc.go → routes.go → handler.go → service.go → repository.go.
//
// Composition: internal/routes mounts RegisterAdmin on the panel admin group
// and applies mw.RequirePermission per admin surface using Service as checker.
//
// See refactor-workstreams/backend-feature-architecture/CHARTER.md.
package rbac
