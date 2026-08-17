package wallet

import "testing"

func TestAdminCreditCapabilityIsNotCustomersWrite(t *testing.T) {
	if AdminCreditCapability != "wallet:credit" {
		t.Fatalf("AdminCreditCapability = %q; want wallet:credit", AdminCreditCapability)
	}
	if AdminCreditCapability == "customers:write" {
		t.Fatal("wallet credit must not alias customers:write")
	}
	if AdminCreditCapability == "roles:manage" {
		t.Fatal("wallet credit must not reuse roles:manage")
	}
}
