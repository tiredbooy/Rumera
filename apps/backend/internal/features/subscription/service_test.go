package subscription

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/tiredbooy/internal/features/addresses"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/pkg/apperr"
)

// memRepo is an in-memory Repository for lifecycle unit tests (no DB).
type memRepo struct {
	byID         map[int64]*Subscription
	due          []DueSubscription
	advanced     []int64
	advanceCalls int
}

func newMemRepo(subs ...Subscription) *memRepo {
	m := &memRepo{byID: make(map[int64]*Subscription)}
	for i := range subs {
		s := subs[i]
		cp := s
		m.byID[s.ID] = &cp
	}
	return m
}

func (m *memRepo) Create(_ context.Context, sub Subscription) (*Subscription, error) {
	sub.ID = int64(len(m.byID) + 1)
	sub.Status = SubscriptionStatusActive
	sub.CreatedAt = time.Now()
	sub.UpdatedAt = sub.CreatedAt
	cp := sub
	m.byID[sub.ID] = &cp
	return &cp, nil
}

func (m *memRepo) ListByUser(_ context.Context, userID int64) ([]Subscription, error) {
	var out []Subscription
	for _, s := range m.byID {
		if s.UserID == userID {
			out = append(out, *s)
		}
	}
	return out, nil
}

func (m *memRepo) Get(_ context.Context, id, userID int64) (*Subscription, error) {
	s, ok := m.byID[id]
	if !ok || s.UserID != userID {
		return nil, models.ErrNotFound
	}
	cp := *s
	return &cp, nil
}

func (m *memRepo) UpdateStatus(_ context.Context, id, userID int64, status SubscriptionStatus) error {
	s, ok := m.byID[id]
	if !ok || s.UserID != userID {
		return models.ErrNotFound
	}
	s.Status = status
	s.UpdatedAt = time.Now()
	return nil
}

func (m *memRepo) SetNextRenewal(_ context.Context, id, userID int64, t time.Time) error {
	s, ok := m.byID[id]
	if !ok || s.UserID != userID {
		return models.ErrNotFound
	}
	s.NextRenewalAt = t
	s.UpdatedAt = time.Now()
	return nil
}

func (m *memRepo) UpdateAddress(_ context.Context, id, userID, addressID int64) error {
	s, ok := m.byID[id]
	if !ok || s.UserID != userID {
		return models.ErrNotFound
	}
	aid := addressID
	s.AddressID = &aid
	s.UpdatedAt = time.Now()
	return nil
}

func addrID(id int64) *int64 { return &id }

// ownAddrLookup accepts any address_id for the caller (happy-path tests).
type ownAddrLookup struct{}

func (ownAddrLookup) GetByID(_ context.Context, id, userID int64) (*addresses.Address, error) {
	return &addresses.Address{ID: id, UserID: userID}, nil
}

// denyAddrLookup treats every address as missing / other-user.
type denyAddrLookup struct{}

func (denyAddrLookup) GetByID(context.Context, int64, int64) (*addresses.Address, error) {
	return nil, models.ErrNotFound
}

// scopedAddrLookup allows only the listed ids for one user.
type scopedAddrLookup struct {
	userID int64
	ids    map[int64]struct{}
}

func (s scopedAddrLookup) GetByID(_ context.Context, id, userID int64) (*addresses.Address, error) {
	if userID != s.userID {
		return nil, models.ErrNotFound
	}
	if _, ok := s.ids[id]; !ok {
		return nil, models.ErrNotFound
	}
	return &addresses.Address{ID: id, UserID: userID}, nil
}

func newSvc(repo Repository) *Service {
	return NewService(repo, ownAddrLookup{})
}

func (m *memRepo) FindDue(context.Context, time.Time, int) ([]DueSubscription, error) {
	out := make([]DueSubscription, len(m.due))
	copy(out, m.due)
	return out, nil
}

func (m *memRepo) AdvanceRenewal(_ context.Context, id int64, next time.Time) error {
	m.advanceCalls++
	s, ok := m.byID[id]
	if !ok {
		return models.ErrNotFound
	}
	s.NextRenewalAt = next
	m.advanced = append(m.advanced, id)
	return nil
}

func TestCreateUsesCellarBoxPlan(t *testing.T) {
	svc := newSvc(newMemRepo())
	got, err := svc.Create(context.Background(), 7, CreateSubscriptionReq{
		Cadence: SubscriptionCadenceMonthly,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if got.Plan != PlanCellarBox {
		t.Fatalf("plan = %q, want %q", got.Plan, PlanCellarBox)
	}
	if got.Status != SubscriptionStatusActive {
		t.Fatalf("status = %q, want active", got.Status)
	}
	if got.Cadence != SubscriptionCadenceMonthly {
		t.Fatalf("cadence = %q", got.Cadence)
	}
}

func TestUpdateLifecycle(t *testing.T) {
	next := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	repo := newMemRepo(Subscription{
		ID:            1,
		UserID:        9,
		Plan:          PlanCellarBox,
		Cadence:       SubscriptionCadenceMonthly,
		Status:        SubscriptionStatusActive,
		NextRenewalAt: next,
	})
	svc := newSvc(repo)

	// skip advances next renewal
	got, err := svc.Update(context.Background(), 9, 1, UpdateSubscriptionReq{Action: SubscriptionActionSkip})
	if err != nil {
		t.Fatalf("skip: %v", err)
	}
	wantNext := NextRenewal(next, SubscriptionCadenceMonthly)
	if !got.NextRenewalAt.Equal(wantNext) {
		t.Fatalf("next after skip = %v, want %v", got.NextRenewalAt, wantNext)
	}

	// pause
	got, err = svc.Update(context.Background(), 9, 1, UpdateSubscriptionReq{Action: SubscriptionActionPause})
	if err != nil {
		t.Fatalf("pause: %v", err)
	}
	if got.Status != SubscriptionStatusPaused {
		t.Fatalf("status = %q, want paused", got.Status)
	}

	// skip while paused is invalid
	_, err = svc.Update(context.Background(), 9, 1, UpdateSubscriptionReq{Action: SubscriptionActionSkip})
	if !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("skip while paused err = %v, want ErrInvalidRequest", err)
	}

	// cancel from paused
	got, err = svc.Update(context.Background(), 9, 1, UpdateSubscriptionReq{Action: SubscriptionActionCancel})
	if err != nil {
		t.Fatalf("cancel: %v", err)
	}
	if got.Status != SubscriptionStatusCancelled {
		t.Fatalf("status = %q, want cancelled", got.Status)
	}

	// resume from cancelled
	got, err = svc.Update(context.Background(), 9, 1, UpdateSubscriptionReq{Action: SubscriptionActionResume})
	if err != nil {
		t.Fatalf("resume: %v", err)
	}
	if got.Status != SubscriptionStatusActive {
		t.Fatalf("status = %q, want active", got.Status)
	}
}

func TestUpdateNotFound(t *testing.T) {
	svc := newSvc(newMemRepo())
	_, err := svc.Update(context.Background(), 1, 99, UpdateSubscriptionReq{Action: SubscriptionActionPause})
	if !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("err = %v, want ErrNotFound", err)
	}
}

func TestUpdateAddressOnActive(t *testing.T) {
	repo := newMemRepo(Subscription{
		ID:     1,
		UserID: 9,
		Plan:   PlanCellarBox,
		Status: SubscriptionStatusActive,
	})
	svc := newSvc(repo)

	got, err := svc.Update(context.Background(), 9, 1, UpdateSubscriptionReq{AddressID: addrID(42)})
	if err != nil {
		t.Fatalf("address-only: %v", err)
	}
	if got.Status != SubscriptionStatusActive {
		t.Fatalf("status = %q, want active (no lifecycle)", got.Status)
	}
	if got.AddressID == nil || *got.AddressID != 42 {
		t.Fatalf("address_id = %v, want 42", got.AddressID)
	}

	got, err = svc.Update(context.Background(), 9, 1, UpdateSubscriptionReq{
		Action:    SubscriptionActionPause,
		AddressID: addrID(7),
	})
	if err != nil {
		t.Fatalf("action+address: %v", err)
	}
	if got.Status != SubscriptionStatusPaused {
		t.Fatalf("status = %q, want paused", got.Status)
	}
	if got.AddressID == nil || *got.AddressID != 7 {
		t.Fatalf("address_id = %v, want 7", got.AddressID)
	}
}

func TestUpdateAddressNotFound(t *testing.T) {
	svc := newSvc(newMemRepo())
	_, err := svc.Update(context.Background(), 1, 99, UpdateSubscriptionReq{AddressID: addrID(3)})
	if !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("err = %v, want ErrNotFound", err)
	}
}

func TestUpdateAddressInvalidID(t *testing.T) {
	repo := newMemRepo(Subscription{
		ID:     1,
		UserID: 9,
		Plan:   PlanCellarBox,
		Status: SubscriptionStatusActive,
	})
	svc := newSvc(repo)

	for _, id := range []int64{0, -1} {
		_, err := svc.Update(context.Background(), 9, 1, UpdateSubscriptionReq{AddressID: addrID(id)})
		if !errors.Is(err, apperr.ErrInvalidRequest) {
			t.Fatalf("address_id=%d err = %v, want ErrInvalidRequest", id, err)
		}
	}

	_, err := svc.Update(context.Background(), 9, 1, UpdateSubscriptionReq{})
	if !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("empty patch err = %v, want ErrInvalidRequest", err)
	}

	stored := repo.byID[1]
	if stored.AddressID != nil {
		t.Fatalf("address_id mutated on invalid id: %v", *stored.AddressID)
	}
}

func TestCreateRejectsSecondActive(t *testing.T) {
	svc := newSvc(newMemRepo())
	if _, err := svc.Create(context.Background(), 7, CreateSubscriptionReq{
		Cadence: SubscriptionCadenceMonthly,
	}); err != nil {
		t.Fatalf("first Create: %v", err)
	}
	_, err := svc.Create(context.Background(), 7, CreateSubscriptionReq{
		Cadence: SubscriptionCadenceQuarterly,
	})
	if !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("second Create err = %v, want ErrConflict", err)
	}
}

func TestCreateAllowsAfterCancel(t *testing.T) {
	svc := newSvc(newMemRepo())
	got, err := svc.Create(context.Background(), 7, CreateSubscriptionReq{
		Cadence: SubscriptionCadenceMonthly,
	})
	if err != nil {
		t.Fatalf("first Create: %v", err)
	}
	if _, err := svc.Update(context.Background(), 7, got.ID, UpdateSubscriptionReq{
		Action: SubscriptionActionCancel,
	}); err != nil {
		t.Fatalf("cancel: %v", err)
	}
	second, err := svc.Create(context.Background(), 7, CreateSubscriptionReq{
		Cadence: SubscriptionCadenceQuarterly,
	})
	if err != nil {
		t.Fatalf("create after cancel: %v", err)
	}
	if second.Status != SubscriptionStatusActive {
		t.Fatalf("status = %q, want active", second.Status)
	}
}

func TestCreateAllowsWhenPaused(t *testing.T) {
	svc := newSvc(newMemRepo())
	first, err := svc.Create(context.Background(), 7, CreateSubscriptionReq{
		Cadence: SubscriptionCadenceMonthly,
	})
	if err != nil {
		t.Fatalf("first Create: %v", err)
	}
	if _, err := svc.Update(context.Background(), 7, first.ID, UpdateSubscriptionReq{
		Action: SubscriptionActionPause,
	}); err != nil {
		t.Fatalf("pause: %v", err)
	}
	second, err := svc.Create(context.Background(), 7, CreateSubscriptionReq{
		Cadence: SubscriptionCadenceQuarterly,
	})
	if err != nil {
		t.Fatalf("create while paused: %v", err)
	}
	if second.Status != SubscriptionStatusActive {
		t.Fatalf("status = %q, want active", second.Status)
	}
}

func TestResumeRejectedWhenAnotherActive(t *testing.T) {
	svc := newSvc(newMemRepo())
	first, err := svc.Create(context.Background(), 7, CreateSubscriptionReq{
		Cadence: SubscriptionCadenceMonthly,
	})
	if err != nil {
		t.Fatalf("first Create: %v", err)
	}
	if _, err := svc.Update(context.Background(), 7, first.ID, UpdateSubscriptionReq{
		Action: SubscriptionActionPause,
	}); err != nil {
		t.Fatalf("pause: %v", err)
	}
	if _, err := svc.Create(context.Background(), 7, CreateSubscriptionReq{
		Cadence: SubscriptionCadenceQuarterly,
	}); err != nil {
		t.Fatalf("second Create: %v", err)
	}
	_, err = svc.Update(context.Background(), 7, first.ID, UpdateSubscriptionReq{
		Action: SubscriptionActionResume,
	})
	if !errors.Is(err, apperr.ErrConflict) {
		t.Fatalf("resume err = %v, want ErrConflict", err)
	}
}

func TestCreateRejectsForeignAddress(t *testing.T) {
	repo := newMemRepo()
	svc := NewService(repo, denyAddrLookup{})
	_, err := svc.Create(context.Background(), 7, CreateSubscriptionReq{
		Cadence:   SubscriptionCadenceMonthly,
		AddressID: addrID(99),
	})
	if !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("err = %v, want ErrNotFound", err)
	}
	if len(repo.byID) != 0 {
		t.Fatal("create must not persist a foreign address_id")
	}
}

func TestCreateAcceptsOwnAddress(t *testing.T) {
	svc := NewService(newMemRepo(), scopedAddrLookup{
		userID: 7,
		ids:    map[int64]struct{}{12: {}},
	})
	got, err := svc.Create(context.Background(), 7, CreateSubscriptionReq{
		Cadence:   SubscriptionCadenceMonthly,
		AddressID: addrID(12),
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if got.AddressID == nil || *got.AddressID != 12 {
		t.Fatalf("address_id = %v, want 12", got.AddressID)
	}
}

func TestUpdateRejectsForeignAddress(t *testing.T) {
	repo := newMemRepo(Subscription{
		ID:     1,
		UserID: 9,
		Plan:   PlanCellarBox,
		Status: SubscriptionStatusActive,
	})
	svc := NewService(repo, denyAddrLookup{})
	_, err := svc.Update(context.Background(), 9, 1, UpdateSubscriptionReq{AddressID: addrID(99)})
	if !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("err = %v, want ErrNotFound", err)
	}
	if repo.byID[1].AddressID != nil {
		t.Fatalf("address_id mutated on foreign id: %v", *repo.byID[1].AddressID)
	}
}
