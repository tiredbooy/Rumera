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

func TestWalletCreditIsDedicatedCatalogueGrant(t *testing.T) {
	if PermWalletCredit != "wallet:credit" {
		t.Fatalf("PermWalletCredit = %q", PermWalletCredit)
	}
	if PermWalletCredit == PermCustomersWrite {
		t.Fatal("wallet:credit must not alias customers:write")
	}
	if !IsKnownPermission(PermWalletCredit) {
		t.Fatal("wallet:credit must be in the closed catalogue")
	}

	svc := NewService(nil)
	ok, err := svc.HasPermission(context.Background(), RoleAdmin, PermWalletCredit)
	if err != nil || !ok {
		t.Fatalf("admin must have wallet:credit; ok=%v err=%v", ok, err)
	}
	ok, err = svc.HasPermission(context.Background(), RoleStaff, PermWalletCredit)
	if err != nil {
		t.Fatalf("staff check: %v", err)
	}
	if ok {
		t.Fatal("staff without a grant must not have wallet:credit")
	}
}
