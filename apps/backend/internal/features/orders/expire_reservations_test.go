package orders

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/tiredbooy/internal/features/inventory"
)

func TestReservationTTL_IsThirtyMinutes(t *testing.T) {
	if ReservationTTL != 30*time.Minute {
		t.Fatalf("ReservationTTL = %s; want 30m", ReservationTTL)
	}
}

func TestNewServiceSatisfiesReservationExpirer(t *testing.T) {
	svc := buildOrderService(nil, nil, nil, nil, nil)
	if _, ok := svc.(interface {
		ExpireStaleReservations(context.Context) (int, error)
	}); !ok {
		t.Fatal("NewService must expose ExpireStaleReservations so bootstrap can type-assert the cron job")
	}
}

func TestReservationCutoff(t *testing.T) {
	now := time.Date(2026, 8, 16, 12, 0, 0, 0, time.UTC)
	got := reservationCutoff(now, ReservationTTL)
	want := now.Add(-30 * time.Minute)
	if !got.Equal(want) {
		t.Fatalf("cutoff = %s; want %s", got, want)
	}
}

func TestExpireSQL_PendingOnlyNotCancelled(t *testing.T) {
	if !strings.Contains(listStalePendingSQL, "status = 'pending'") {
		t.Fatal("list query must filter status = pending")
	}
	if !strings.Contains(listStalePendingSQL, "created_at < $1") {
		t.Fatal("list query must apply created_at TTL cutoff")
	}
	if strings.Contains(listStalePendingSQL, "cancelled") {
		t.Fatal("list query must not target cancelled orders")
	}

	if !strings.Contains(markPaymentFailedIfPendingSQL, "status = 'payment_failed'") {
		t.Fatal("mark must flip to payment_failed")
	}
	if !strings.Contains(markPaymentFailedIfPendingSQL, "status = 'pending'") {
		t.Fatal("mark must CAS on pending")
	}
	if strings.Contains(markPaymentFailedIfPendingSQL, "cancelled") {
		t.Fatal("TTL must not cancel; PR-020f may still collect")
	}

	if !strings.Contains(failPendingPaymentsSQL, "status        = 'failed'") &&
		!strings.Contains(failPendingPaymentsSQL, "status = 'failed'") {
		t.Fatal("payment update must set status failed")
	}
	if !strings.Contains(failPendingPaymentsSQL, "status   = 'pending'") &&
		!strings.Contains(failPendingPaymentsSQL, "status = 'pending'") {
		t.Fatal("payment update must only touch pending rows")
	}
}

func TestExpireStoreOf(t *testing.T) {
	if expireStoreOf(nil) != nil {
		t.Fatal("nil repo should yield nil store")
	}
	if expireStoreOf(&orderRepoStub{}) != nil {
		t.Fatal("plain Repository stub should not satisfy reservationExpireStore")
	}
	fake := &expireRepoFake{}
	if expireStoreOf(fake) == nil {
		t.Fatal("expireRepoFake should satisfy reservationExpireStore")
	}
}

func TestExpireStaleReservations_Table(t *testing.T) {
	now := time.Date(2026, 8, 16, 12, 0, 0, 0, time.UTC)
	lines := []OrderItemResponse{
		{VariantID: 10, Quantity: 2},
		{VariantID: 20, Quantity: 1},
	}

	tests := []struct {
		name          string
		repo          *expireRepoFake
		inv           *releaseInvFake
		nilInventory  bool
		plainRepo     bool
		wantExpired   int
		wantErr       bool
		wantReleased  []int64
		wantFailedPay []int64
		wantMarked    []int64
		wantCutoff    time.Time
	}{
		{
			name:        "empty batch",
			repo:        &expireRepoFake{},
			inv:         &releaseInvFake{},
			wantExpired: 0,
			wantCutoff:  now.Add(-ReservationTTL),
		},
		{
			name: "one stale releases and fails payment",
			repo: &expireRepoFake{
				orderRepoStub: orderRepoStub{itemsFn: func(context.Context, int64) ([]OrderItemResponse, error) {
					return lines, nil
				}},
				stale: []int64{42},
			},
			inv:           &releaseInvFake{},
			wantExpired:   1,
			wantReleased:  []int64{42},
			wantFailedPay: []int64{42},
			wantMarked:    []int64{42},
			wantCutoff:    now.Add(-ReservationTTL),
		},
		{
			name: "already settled skips release and payments",
			repo: &expireRepoFake{
				orderRepoStub: orderRepoStub{itemsFn: func(context.Context, int64) ([]OrderItemResponse, error) {
					return lines, nil
				}},
				stale:   []int64{7},
				claimed: map[int64]bool{7: false},
			},
			inv:          &releaseInvFake{},
			wantExpired:  0,
			wantReleased: nil,
			wantMarked:   []int64{7},
		},
		{
			name: "mixed batch marks only claimed",
			repo: &expireRepoFake{
				orderRepoStub: orderRepoStub{itemsFn: func(_ context.Context, id int64) ([]OrderItemResponse, error) {
					return lines, nil
				}},
				stale:   []int64{1, 2, 3},
				claimed: map[int64]bool{1: true, 2: false, 3: true},
			},
			inv:           &releaseInvFake{},
			wantExpired:   2,
			wantReleased:  []int64{1, 3},
			wantFailedPay: []int64{1, 3},
			wantMarked:    []int64{1, 2, 3},
		},
		{
			name: "mark error skips that id and continues",
			repo: &expireRepoFake{
				orderRepoStub: orderRepoStub{itemsFn: func(context.Context, int64) ([]OrderItemResponse, error) {
					return lines, nil
				}},
				stale:   []int64{8, 9},
				markErr: map[int64]error{8: errors.New("db busy")},
			},
			inv:           &releaseInvFake{},
			wantExpired:   1,
			wantReleased:  []int64{9},
			wantFailedPay: []int64{9},
			wantMarked:    []int64{8, 9},
		},
		{
			name: "release error still fails payments and counts",
			repo: &expireRepoFake{
				orderRepoStub: orderRepoStub{itemsFn: func(context.Context, int64) ([]OrderItemResponse, error) {
					return lines, nil
				}},
				stale: []int64{11},
			},
			inv:           &releaseInvFake{err: errors.New("lock")},
			wantExpired:   1,
			wantReleased:  []int64{11},
			wantFailedPay: []int64{11},
			wantMarked:    []int64{11},
		},
		{
			name: "list error fails the tick",
			repo: &expireRepoFake{
				listErr: errors.New("timeout"),
			},
			inv:     &releaseInvFake{},
			wantErr: true,
		},
		{
			name:         "nil inventory does not list or mark",
			repo:         &expireRepoFake{stale: []int64{1}},
			nilInventory: true,
			wantErr:      true,
			wantMarked:   nil,
		},
		{
			name:      "plain repo unsupported",
			plainRepo: true,
			wantErr:   true,
		},
		{
			name: "no stock lines still fails payments",
			repo: &expireRepoFake{
				stale: []int64{5},
			},
			inv:           &releaseInvFake{},
			wantExpired:   1,
			wantReleased:  nil,
			wantFailedPay: []int64{5},
			wantMarked:    []int64{5},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &orderService{}
			if tt.plainRepo {
				s.orderRepo = &orderRepoStub{}
			} else {
				s.orderRepo = tt.repo
			}
			if !tt.nilInventory {
				s.inventory = tt.inv
			}

			got, err := s.expireStaleReservationsAt(context.Background(), now)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error")
				}
				if tt.repo != nil && len(tt.repo.marked) != 0 && tt.nilInventory {
					t.Fatalf("marked = %v; want none when inventory missing", tt.repo.marked)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected err: %v", err)
			}
			if got != tt.wantExpired {
				t.Fatalf("expired = %d; want %d", got, tt.wantExpired)
			}
			if tt.wantCutoff.IsZero() == false && !tt.repo.gotCutoff.Equal(tt.wantCutoff) {
				t.Fatalf("cutoff = %s; want %s", tt.repo.gotCutoff, tt.wantCutoff)
			}
			if !int64sEqual(tt.repo.marked, tt.wantMarked) {
				t.Fatalf("marked = %v; want %v", tt.repo.marked, tt.wantMarked)
			}
			if !int64sEqual(tt.repo.failedPays, tt.wantFailedPay) {
				t.Fatalf("failedPays = %v; want %v", tt.repo.failedPays, tt.wantFailedPay)
			}
			var released []int64
			if tt.inv != nil {
				for _, c := range tt.inv.calls {
					released = append(released, c.orderID)
				}
			}
			if !int64sEqual(released, tt.wantReleased) {
				t.Fatalf("released = %v; want %v", released, tt.wantReleased)
			}
			if len(tt.wantReleased) > 0 && tt.inv != nil {
				for _, c := range tt.inv.calls {
					if len(c.lines) != 2 || c.lines[0].VariantID != 10 || c.lines[1].VariantID != 20 {
						t.Fatalf("released lines = %+v; want GetStockLines output", c.lines)
					}
				}
			}
		})
	}
}

func TestExpireStaleReservations_ContextCancel(t *testing.T) {
	repo := &expireRepoFake{stale: []int64{1, 2}}
	s := &orderService{orderRepo: repo, inventory: &releaseInvFake{}}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	n, err := s.expireStaleReservationsAt(ctx, time.Now())
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("err = %v; want context.Canceled", err)
	}
	if n != 0 {
		t.Fatalf("expired = %d; want 0", n)
	}
	if len(repo.marked) != 0 {
		t.Fatalf("marked = %v; cancelled ctx must not expire", repo.marked)
	}
}

type expireRepoFake struct {
	orderRepoStub
	stale      []int64
	listErr    error
	claimed    map[int64]bool
	markErr    map[int64]error
	failErr    map[int64]error
	marked     []int64
	failedPays []int64
	gotCutoff  time.Time
	gotLimit   int
}

func (r *expireRepoFake) ListStalePending(_ context.Context, olderThan time.Time, limit int) ([]int64, error) {
	r.gotCutoff = olderThan
	r.gotLimit = limit
	if r.listErr != nil {
		return nil, r.listErr
	}
	return r.stale, nil
}

func (r *expireRepoFake) MarkPaymentFailedIfPending(_ context.Context, id int64) (bool, error) {
	r.marked = append(r.marked, id)
	if err := r.markErr[id]; err != nil {
		return false, err
	}
	if r.claimed != nil {
		if claimed, ok := r.claimed[id]; ok {
			return claimed, nil
		}
	}
	return true, nil
}

func (r *expireRepoFake) FailPendingPayments(_ context.Context, orderID int64) (int64, error) {
	if err := r.failErr[orderID]; err != nil {
		return 0, err
	}
	r.failedPays = append(r.failedPays, orderID)
	return 1, nil
}

type releaseCall struct {
	orderID int64
	lines   []inventory.StockLine
}

type releaseInvFake struct {
	inventory.Service
	calls []releaseCall
	err   error
}

func (f *releaseInvFake) ReleaseForOrder(_ context.Context, orderID int64, items []inventory.StockLine) error {
	cp := make([]inventory.StockLine, len(items))
	copy(cp, items)
	f.calls = append(f.calls, releaseCall{orderID: orderID, lines: cp})
	return f.err
}

func int64sEqual(a, b []int64) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
