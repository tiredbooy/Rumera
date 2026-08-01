//go:build integration

package integration

import (
	"context"
	"errors"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
	"github.com/tiredbooy/internal/services"
	"github.com/tiredbooy/pkg/apperr"
	"github.com/tiredbooy/pkg/crypto"
)

func TestAdminAuthorizationMigrationPolicy(t *testing.T) {
	requireDB(t)
	ctx := context.Background()

	for _, table := range []string{"roles", "permissions", "user_roles", "role_permissions"} {
		var present bool
		if err := testPool.QueryRow(ctx, `SELECT to_regclass('public.' || $1) IS NOT NULL`, table).Scan(&present); err != nil {
			t.Fatalf("inspect %s: %v", table, err)
		}
		if !present {
			t.Fatalf("dormant RBAC table %s was destructively removed", table)
		}
	}

	var auditExists bool
	if err := testPool.QueryRow(ctx,
		`SELECT to_regclass('public.user_admin_audit_events') IS NOT NULL`,
	).Scan(&auditExists); err != nil || !auditExists {
		t.Fatalf("audit table exists = %v, err = %v", auditExists, err)
	}

	var indexCount int
	if err := testPool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM pg_indexes
		WHERE schemaname = 'public'
		  AND indexname IN (
		      'users_user_id_unique_idx',
		      'users_role_is_active_idx',
		      'users_created_at_id_idx',
		      'user_admin_audit_target_created_idx'
		  )`).Scan(&indexCount); err != nil || indexCount != 4 {
		t.Fatalf("authorization indexes = %d, err = %v; want 4", indexCount, err)
	}

	if _, err := testPool.Exec(ctx, `
		INSERT INTO users (user_id, email, role)
		VALUES (gen_random_uuid(), 'unsupported-role@test.local', 'support')`); err == nil {
		t.Fatal("unsupported users.role insert succeeded")
	}
}

func TestAdminUserLifecycleIsTransactionalAuditedAndRedacted(t *testing.T) {
	requireDB(t)
	resetTables(t, "user_admin_audit_events", "users")
	ctx := context.Background()
	repo := repositories.NewUserRepository(testPool)
	service := services.NewUserService(repo)
	actorID := seedAdminActor(t, "actor@test.local")

	firstName := "Sensitive Name"
	phone := "09120000000"
	nationalCode := "0012345678"
	created, err := service.AdminCreate(ctx, actorID, models.AdminCreateUserReq{
		Email:        "created@test.local",
		Password:     "password123",
		FirstName:    &firstName,
		Phone:        &phone,
		NationalCode: &nationalCode,
	})
	if err != nil {
		t.Fatalf("admin create: %v", err)
	}
	if created.Role != models.UserRoleCustomer || !created.IsActive {
		t.Fatalf("created role/status = %q/%v; want customer/true", created.Role, created.IsActive)
	}
	var passwordHash *string
	if err := testPool.QueryRow(ctx,
		`SELECT password_hash FROM users WHERE user_id = $1`, created.UserID,
	).Scan(&passwordHash); err != nil {
		t.Fatalf("read password hash: %v", err)
	}
	if passwordHash == nil || !crypto.CheckPasswordHash("password123", *passwordHash) {
		t.Fatal("admin-created password was not hashed by the server")
	}
	var loyaltyCount int
	if err := testPool.QueryRow(ctx,
		`SELECT COUNT(*) FROM loyalty_accounts WHERE user_id = $1`, created.ID,
	).Scan(&loyaltyCount); err != nil || loyaltyCount != 0 {
		t.Fatalf("loyalty accounts = %d, err = %v; want none", loyaltyCount, err)
	}

	for name, req := range map[string]models.AdminCreateUserReq{
		"email": {
			Email: "created@test.local", Password: "password123",
		},
		"phone": {
			Email: "other@test.local", Password: "password123", Phone: &phone,
		},
		"national code": {
			Email: "third@test.local", Password: "password123", NationalCode: &nationalCode,
		},
	} {
		t.Run("duplicate "+name, func(t *testing.T) {
			if _, err := service.AdminCreate(ctx, actorID, req); !errors.Is(err, apperr.ErrConflict) {
				t.Fatalf("error = %v; want stable conflict", err)
			}
		})
	}

	inactive := false
	vendor := models.UserRoleVendor
	update := models.AdminUpdateUserReq{
		FirstName: models.NullablePatch[string]{Set: true},
		Role:      models.NullablePatch[string]{Set: true, Value: &vendor},
		IsActive:  models.NullablePatch[bool]{Set: true, Value: &inactive},
	}
	time.Sleep(2 * time.Millisecond)
	updated, err := service.AdminUpdate(ctx, actorID, created.UserID, update)
	if err != nil {
		t.Fatalf("admin update: %v", err)
	}
	if updated.FirstName != nil || updated.Role != models.UserRoleVendor || updated.IsActive {
		t.Fatalf("updated user = %+v", updated)
	}
	if _, err := service.GetByIDIncludingInactive(ctx, created.UserID); err != nil {
		t.Fatalf("inactive admin detail: %v", err)
	}

	filter := models.UserFilter{}
	filter.Defaults()
	users, total, err := service.GetAll(ctx, filter)
	if err != nil {
		t.Fatalf("list all users: %v", err)
	}
	if int64(len(users)) != total || !containsUser(users, created.UserID, false) {
		t.Fatalf("default list total/users = %d/%+v; inactive target missing", total, users)
	}

	active := true
	time.Sleep(2 * time.Millisecond)
	if _, err := service.AdminUpdate(ctx, actorID, created.UserID, models.AdminUpdateUserReq{
		IsActive: models.NullablePatch[bool]{Set: true, Value: &active},
	}); err != nil {
		t.Fatalf("reactivate: %v", err)
	}
	time.Sleep(2 * time.Millisecond)
	if err := service.AdminDeactivate(ctx, actorID, created.UserID); err != nil {
		t.Fatalf("deactivate: %v", err)
	}
	// Repeating DELETE is idempotent and must not fabricate another audit event.
	if err := service.AdminDeactivate(ctx, actorID, created.UserID); err != nil {
		t.Fatalf("repeat deactivate: %v", err)
	}

	auditFilter := models.AdminUserAuditFilter{}
	auditFilter.Defaults()
	events, totalEvents, err := service.GetAdminAudit(ctx, created.UserID, auditFilter)
	if err != nil {
		t.Fatalf("get audit: %v", err)
	}
	if totalEvents != 4 || len(events) != 4 {
		t.Fatalf("audit events = %d/%d; want 4", len(events), totalEvents)
	}
	if events[0].Action != models.AdminUserAuditDeactivated ||
		events[len(events)-1].Action != models.AdminUserAuditCreated {
		t.Fatalf("audit order = %+v; want newest-first", events)
	}
	if events[0].ActorUserID != actorID || events[0].ActorEmail != "actor@test.local" {
		t.Fatalf("audit actor = %s/%q", events[0].ActorUserID, events[0].ActorEmail)
	}

	var accessUpdate *models.AdminUserAuditEvent
	for i := range events {
		if events[i].Action == models.AdminUserAuditUpdated &&
			slices.Equal(events[i].ChangedFields, []string{"first_name", "role", "is_active"}) {
			accessUpdate = &events[i]
			break
		}
	}
	if accessUpdate == nil {
		t.Fatalf("profile/access update event missing: %+v", events)
	}
	if len(accessUpdate.Changes) != 2 || accessUpdate.Changes["role"].Before != models.UserRoleCustomer ||
		accessUpdate.Changes["role"].After != models.UserRoleVendor ||
		accessUpdate.Changes["is_active"].Before != true || accessUpdate.Changes["is_active"].After != false {
		t.Fatalf("redacted access changes = %#v", accessUpdate.Changes)
	}
	if _, leaked := accessUpdate.Changes["first_name"]; leaked {
		t.Fatalf("profile value leaked into changes: %#v", accessUpdate.Changes)
	}

	var persistedChanges string
	if err := testPool.QueryRow(ctx, `
		SELECT changes::text
		FROM user_admin_audit_events
		WHERE target_user_id = $1 AND action = 'user.updated'
		  AND changed_fields @> ARRAY['first_name']::text[]`, created.UserID,
	).Scan(&persistedChanges); err != nil {
		t.Fatalf("read persisted changes: %v", err)
	}
	for _, sensitive := range []string{firstName, phone, nationalCode, "password123", created.Email} {
		if strings.Contains(persistedChanges, sensitive) {
			t.Fatalf("audit changes leaked %q: %s", sensitive, persistedChanges)
		}
	}

	page := models.AdminUserAuditFilter{PaginationParams: models.PaginationParams{Page: 2, Limit: 2}}
	pageTwo, pageTotal, err := service.GetAdminAudit(ctx, created.UserID, page)
	if err != nil || pageTotal != 4 || len(pageTwo) != 2 || pageTwo[1].Action != models.AdminUserAuditCreated {
		t.Fatalf("audit page two = %+v, total = %d, err = %v", pageTwo, pageTotal, err)
	}

	var bannedVendorID uuid.UUID
	if err := testPool.QueryRow(ctx, `
		INSERT INTO users (user_id, email, role, is_active, is_banned, banned_at)
		VALUES (gen_random_uuid(), 'banned-vendor@test.local', 'vendor', true, true, NOW())
		RETURNING user_id`).Scan(&bannedVendorID); err != nil {
		t.Fatalf("seed banned vendor: %v", err)
	}
	inactiveFilter := models.UserFilter{IsActive: boolPointer(false)}
	inactiveFilter.Defaults()
	inactiveUsers, _, err := service.GetAll(ctx, inactiveFilter)
	if err != nil || !containsUserState(inactiveUsers, bannedVendorID, true, true) {
		t.Fatalf("inactive filter omitted banned active row: users=%+v, err=%v", inactiveUsers, err)
	}
	activeFilter := models.UserFilter{IsActive: boolPointer(true)}
	activeFilter.Defaults()
	activeUsers, _, err := service.GetAll(ctx, activeFilter)
	if err != nil {
		t.Fatalf("active filter: %v", err)
	}
	if containsUserState(activeUsers, bannedVendorID, true, true) {
		t.Fatal("active filter included a banned row")
	}

	counts, err := repo.GetRoleCounts(ctx)
	if err != nil || counts[models.UserRoleVendor].MemberCount != 2 ||
		counts[models.UserRoleVendor].ActiveMemberCount != 0 {
		t.Fatalf("role counts = %+v, err = %v", counts, err)
	}
}

func TestAdminMutationRepositoryRevalidatesActorAndRejectsSelfLockout(t *testing.T) {
	requireDB(t)
	resetTables(t, "user_admin_audit_events", "users")
	ctx := context.Background()
	repo := repositories.NewUserRepository(testPool)
	actorID := seedAdminActor(t, "actor-guard@test.local")
	targetID := seedCustomer(t, "target-guard@test.local", true)
	customer := models.UserRoleCustomer
	inactive := false

	if _, err := repo.AdminUpdate(ctx, actorID, actorID, models.AdminUpdateUserReq{
		Role: models.NullablePatch[string]{Set: true, Value: &customer},
	}); !errors.Is(err, models.ErrAccessDenied) {
		t.Fatalf("repository self-demotion error = %v; want ErrAccessDenied", err)
	}
	if err := repo.AdminDeactivate(ctx, actorID, actorID); !errors.Is(err, models.ErrAccessDenied) {
		t.Fatalf("repository self-delete error = %v; want ErrAccessDenied", err)
	}

	if _, err := testPool.Exec(ctx, `UPDATE users SET role = 'customer' WHERE user_id = $1`, actorID); err != nil {
		t.Fatalf("demote actor fixture: %v", err)
	}
	if _, err := repo.AdminCreate(ctx, actorID, models.AdminCreateUserParams{
		Email: "blocked-create@test.local", Role: models.UserRoleCustomer, IsActive: true,
	}, "server-hash"); !errors.Is(err, models.ErrAccessDenied) {
		t.Fatalf("demoted actor create error = %v; want ErrAccessDenied", err)
	}
	if _, err := repo.AdminUpdate(ctx, actorID, targetID, models.AdminUpdateUserReq{
		IsActive: models.NullablePatch[bool]{Set: true, Value: &inactive},
	}); !errors.Is(err, models.ErrAccessDenied) {
		t.Fatalf("demoted actor error = %v; want ErrAccessDenied", err)
	}
	if _, err := testPool.Exec(ctx, `UPDATE users SET role = 'admin', is_active = false WHERE user_id = $1`, actorID); err != nil {
		t.Fatalf("deactivate actor fixture: %v", err)
	}
	if err := repo.AdminDeactivate(ctx, actorID, targetID); !errors.Is(err, models.ErrAccessDenied) {
		t.Fatalf("inactive actor error = %v; want ErrAccessDenied", err)
	}

	var eventCount int
	if err := testPool.QueryRow(ctx, `SELECT COUNT(*) FROM user_admin_audit_events`).Scan(&eventCount); err != nil {
		t.Fatalf("count guard audit events: %v", err)
	}
	if eventCount != 0 {
		t.Fatalf("rejected mutations wrote %d audit events", eventCount)
	}
}

func seedAdminActor(t *testing.T, email string) uuid.UUID {
	t.Helper()
	var userID uuid.UUID
	if err := testPool.QueryRow(context.Background(), `
		INSERT INTO users (user_id, email, role, is_active)
		VALUES (gen_random_uuid(), $1, 'admin', true)
		RETURNING user_id`, email).Scan(&userID); err != nil {
		t.Fatalf("seed admin actor: %v", err)
	}
	return userID
}

func seedCustomer(t *testing.T, email string, isActive bool) uuid.UUID {
	t.Helper()
	var userID uuid.UUID
	if err := testPool.QueryRow(context.Background(), `
		INSERT INTO users (user_id, email, role, is_active)
		VALUES (gen_random_uuid(), $1, 'customer', $2)
		RETURNING user_id`, email, isActive).Scan(&userID); err != nil {
		t.Fatalf("seed customer: %v", err)
	}
	return userID
}

func containsUser(users []*models.UserListItem, userID uuid.UUID, isActive bool) bool {
	for _, user := range users {
		if user.UserID == userID && user.IsActive == isActive {
			return true
		}
	}
	return false
}

func containsUserState(users []*models.UserListItem, userID uuid.UUID, isActive, isBanned bool) bool {
	for _, user := range users {
		if user.UserID == userID && user.IsActive == isActive && user.IsBanned == isBanned {
			return true
		}
	}
	return false
}

func boolPointer(value bool) *bool { return &value }
