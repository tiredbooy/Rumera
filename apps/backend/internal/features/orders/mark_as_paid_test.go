package orders

import (
	"strings"
	"testing"
)

func TestMarkAsPaidSQLSetsPaidAt(t *testing.T) {
	q := compactSQL(markAsPaidSQL)
	if !strings.Contains(q, "paid_at") {
		t.Fatalf("MarkAsPaid UPDATE must set paid_at:\n%s", markAsPaidSQL)
	}
	if !strings.Contains(q, "status = 'paid'") {
		t.Fatal("MarkAsPaid must set status='paid'")
	}
	if !strings.Contains(q, "and status = 'pending'") {
		t.Fatal("MarkAsPaid must only transition pending → paid")
	}
}

func compactSQL(s string) string {
	return strings.Join(strings.Fields(strings.ToLower(s)), " ")
}
