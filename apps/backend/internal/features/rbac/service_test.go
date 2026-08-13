package rbac

import (
	"context"
	"testing"
)

func TestAdminIsSuperuser(t *testing.T) {
	svc := NewService(nil)
	ok, err := svc.HasPermission(context.Background(), RoleAdmin, PermProductsWrite)
	if err != nil || !ok {
		t.Fatalf("admin should have products:write; ok=%v err=%v", ok, err)
	}
}

func TestStaffFailsClosedWithoutRepo(t *testing.T) {
	svc := NewService(nil)
	ok, err := svc.HasPermission(context.Background(), RoleStaff, PermProductsWrite)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if ok {
		t.Fatal("staff without grants must not have products:write")
	}
}

func TestCustomerHasNoPanelPermissions(t *testing.T) {
	svc := NewService(nil)
	ok, err := svc.HasPermission(context.Background(), "customer", PermProductsRead)
	if err != nil || ok {
		t.Fatalf("customer must not have panel perms; ok=%v err=%v", ok, err)
	}
}

func TestListMatrixWithoutRepo(t *testing.T) {
	svc := NewService(nil)
	items, err := svc.ListMatrix(context.Background())
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("want 2 rows, got %d", len(items))
	}
}
