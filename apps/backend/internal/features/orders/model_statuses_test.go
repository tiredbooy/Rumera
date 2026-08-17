package orders

import (
	"errors"
	"testing"

	"github.com/tiredbooy/pkg/apperr"
)

// S-1. The work queue needs one URL for "paid but not yet shipped", which spans
// three statuses. Single-value `status=` could not express it.
func TestValidStatusesParsesWorkQueueSpan(t *testing.T) {
	f := OrderFilter{Statuses: "paid,processing,ready_to_ship"}
	got, err := f.ValidStatuses()
	if err != nil {
		t.Fatal(err)
	}
	want := []OrderStatus{OrderStatusPaid, OrderStatusProcessing, OrderStatusReadyToShip}
	if len(got) != len(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("got %v, want %v", got, want)
		}
	}
}

func TestValidStatusesIgnoresBlanksAndDuplicates(t *testing.T) {
	f := OrderFilter{Statuses: " paid , ,paid,  processing "}
	got, err := f.ValidStatuses()
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got[0] != OrderStatusPaid || got[1] != OrderStatusProcessing {
		t.Fatalf("got %v, want [paid processing]", got)
	}
}

// orders.status is a PG enum: an unknown literal reaching the query is a 500.
// It has to be rejected as a bad request first.
func TestValidStatusesRejectsUnknownStatus(t *testing.T) {
	f := OrderFilter{Statuses: "paid,not_a_status"}
	if _, err := f.ValidStatuses(); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("err = %v, want ErrInvalidRequest", err)
	}
}

func TestValidStatusesEmptyIsNoFilter(t *testing.T) {
	for _, in := range []string{"", "   ", ","} {
		f := OrderFilter{Statuses: in}
		got, err := f.ValidStatuses()
		if err != nil || len(got) != 0 {
			t.Fatalf("ValidStatuses(%q) = %v, %v; want empty, nil", in, got, err)
		}
	}
}
