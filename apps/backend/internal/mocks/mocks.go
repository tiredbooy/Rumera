// Package mocks provides hand-written test doubles for the repository interfaces
// on the money paths (order, cart, coupon, inventory, payment, wallet), plus a
// no-op pgx.Tx. Each mock exposes a function field per method the services call;
// unset fields return zero values, so a test only wires the behaviour it cares
// about. Compile-time assertions below keep the mocks in lock-step with the
// repository interfaces.
package mocks

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/tiredbooy/internal/models"
	"github.com/tiredbooy/internal/repositories"
)

// ── FakeTx ───────────────────────────────────────────────────────────────────

// FakeTx is a no-op pgx.Tx that records whether it was committed or rolled back.
type FakeTx struct {
	Committed  bool
	RolledBack bool
	CommitErr  error
}

func (t *FakeTx) Commit(context.Context) error          { t.Committed = true; return t.CommitErr }
func (t *FakeTx) Rollback(context.Context) error        { t.RolledBack = true; return nil }
func (t *FakeTx) Begin(context.Context) (pgx.Tx, error) { return t, nil }
func (t *FakeTx) CopyFrom(context.Context, pgx.Identifier, []string, pgx.CopyFromSource) (int64, error) {
	return 0, nil
}
func (t *FakeTx) SendBatch(context.Context, *pgx.Batch) pgx.BatchResults { return nil }
func (t *FakeTx) LargeObjects() pgx.LargeObjects                         { return pgx.LargeObjects{} }
func (t *FakeTx) Prepare(context.Context, string, string) (*pgconn.StatementDescription, error) {
	return nil, nil
}
func (t *FakeTx) Exec(context.Context, string, ...any) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, nil
}
func (t *FakeTx) Query(context.Context, string, ...any) (pgx.Rows, error) { return nil, nil }
func (t *FakeTx) QueryRow(context.Context, string, ...any) pgx.Row        { return nil }
func (t *FakeTx) Conn() *pgx.Conn                                         { return nil }

// txOr returns the supplied tx or a fresh FakeTx when nil.
func txOr(tx pgx.Tx) pgx.Tx {
	if tx != nil {
		return tx
	}
	return &FakeTx{}
}

// ── OrderRepository ──────────────────────────────────────────────────────────

type OrderRepo struct {
	Tx           pgx.Tx
	CreateFn     func(ctx context.Context, tx pgx.Tx, req models.CreateOrderReq, userID int64, subtotal, discountAmount, shippingCost, taxAmount float64, couponID *int64) (*models.Order, error)
	GetItemsFn   func(ctx context.Context, orderID int64) ([]models.OrderItemResponse, error)
	CancelFn     func(ctx context.Context, id, userID int64) error
	MarkAsPaidFn func(ctx context.Context, tx pgx.Tx, orderID int64) error
}

func (m *OrderRepo) BeginTx(context.Context) (pgx.Tx, error) { return txOr(m.Tx), nil }
func (m *OrderRepo) Create(ctx context.Context, tx pgx.Tx, req models.CreateOrderReq, userID int64, subtotal, discountAmount, shippingCost, taxAmount float64, couponID *int64) (*models.Order, error) {
	if m.CreateFn != nil {
		return m.CreateFn(ctx, tx, req, userID, subtotal, discountAmount, shippingCost, taxAmount, couponID)
	}
	return &models.Order{}, nil
}
func (m *OrderRepo) GetItems(ctx context.Context, orderID int64) ([]models.OrderItemResponse, error) {
	if m.GetItemsFn != nil {
		return m.GetItemsFn(ctx, orderID)
	}
	return nil, nil
}
func (m *OrderRepo) Cancel(ctx context.Context, id, userID int64) error {
	if m.CancelFn != nil {
		return m.CancelFn(ctx, id, userID)
	}
	return nil
}
func (m *OrderRepo) MarkAsPaid(ctx context.Context, tx pgx.Tx, orderID int64) error {
	if m.MarkAsPaidFn != nil {
		return m.MarkAsPaidFn(ctx, tx, orderID)
	}
	return nil
}
func (m *OrderRepo) GetByID(context.Context, int64) (*models.Order, error) { return nil, nil }
func (m *OrderRepo) GetByIDAndUserID(context.Context, int64, int64) (*models.Order, error) {
	return nil, nil
}
func (m *OrderRepo) GetAll(context.Context, models.OrderFilter) ([]models.OrderListItem, int64, error) {
	return nil, 0, nil
}
func (m *OrderRepo) UpdateStatus(context.Context, int64, models.UpdateOrderStatusReq) (*models.Order, error) {
	return nil, nil
}

// ── OrderItemRepository ──────────────────────────────────────────────────────

type OrderItemRepo struct {
	BulkCreateFn func(ctx context.Context, tx pgx.Tx, orderID int64, items []models.CartItemResponse) error
}

func (m *OrderItemRepo) BulkCreate(ctx context.Context, tx pgx.Tx, orderID int64, items []models.CartItemResponse) error {
	if m.BulkCreateFn != nil {
		return m.BulkCreateFn(ctx, tx, orderID, items)
	}
	return nil
}

// ── CartRepository ───────────────────────────────────────────────────────────

type CartRepo struct {
	GetOrCreateFn func(ctx context.Context, userID int64) (*models.Cart, error)
	GetItemsFn    func(ctx context.Context, cartID int64) ([]models.CartItemResponse, error)
	ClearFn       func(ctx context.Context, tx pgx.Tx, cartID int64) error
}

func (m *CartRepo) GetOrCreate(ctx context.Context, userID int64) (*models.Cart, error) {
	if m.GetOrCreateFn != nil {
		return m.GetOrCreateFn(ctx, userID)
	}
	return &models.Cart{ID: 1}, nil
}
func (m *CartRepo) GetItems(ctx context.Context, cartID int64) ([]models.CartItemResponse, error) {
	if m.GetItemsFn != nil {
		return m.GetItemsFn(ctx, cartID)
	}
	return nil, nil
}
func (m *CartRepo) Clear(ctx context.Context, tx pgx.Tx, cartID int64) error {
	if m.ClearFn != nil {
		return m.ClearFn(ctx, tx, cartID)
	}
	return nil
}
func (m *CartRepo) GetByUserID(context.Context, int64) (*models.Cart, error) { return nil, nil }
func (m *CartRepo) Delete(context.Context, int64) error                      { return nil }
func (m *CartRepo) AddItem(context.Context, int64, models.AddCartItemReq) (*models.CartItem, error) {
	return nil, nil
}
func (m *CartRepo) UpdateItem(context.Context, int64, int64, models.UpdateCartItemReq) (*models.CartItem, error) {
	return nil, nil
}
func (m *CartRepo) RemoveItem(context.Context, int64, int64) error { return nil }

// ── CouponRepository ─────────────────────────────────────────────────────────

type CouponRepo struct {
	GetByCodeFn           func(ctx context.Context, code string) (*models.Coupon, error)
	CountUsagesFn         func(ctx context.Context, couponID int64) (int, error)
	CountUsagesByUserFn   func(ctx context.Context, couponID, userID int64) (int, error)
	LockByIDFn            func(ctx context.Context, tx pgx.Tx, id int64) error
	CountUsagesTxFn       func(ctx context.Context, tx pgx.Tx, couponID int64) (int, error)
	CountUsagesByUserTxFn func(ctx context.Context, tx pgx.Tx, couponID, userID int64) (int, error)
}

func (m *CouponRepo) GetByCode(ctx context.Context, code string) (*models.Coupon, error) {
	if m.GetByCodeFn != nil {
		return m.GetByCodeFn(ctx, code)
	}
	return nil, models.ErrNotFound
}
func (m *CouponRepo) CountUsages(ctx context.Context, couponID int64) (int, error) {
	if m.CountUsagesFn != nil {
		return m.CountUsagesFn(ctx, couponID)
	}
	return 0, nil
}
func (m *CouponRepo) CountUsagesByUser(ctx context.Context, couponID, userID int64) (int, error) {
	if m.CountUsagesByUserFn != nil {
		return m.CountUsagesByUserFn(ctx, couponID, userID)
	}
	return 0, nil
}
func (m *CouponRepo) Create(context.Context, models.CreateCouponReq) (*models.Coupon, error) {
	return nil, nil
}
func (m *CouponRepo) GetByID(context.Context, int64) (*models.Coupon, error) { return nil, nil }
func (m *CouponRepo) GetAll(context.Context, models.CouponFilter) ([]*models.Coupon, int64, error) {
	return nil, 0, nil
}
func (m *CouponRepo) Update(context.Context, int64, models.UpdateCouponReq) (*models.Coupon, error) {
	return nil, nil
}
func (m *CouponRepo) Delete(context.Context, int64) error                { return nil }
func (m *CouponRepo) Deactivate(context.Context, int64) (*models.Coupon, error) {
	return nil, nil
}
func (m *CouponRepo) ExistsByCode(context.Context, string) (bool, error) { return false, nil }
func (m *CouponRepo) GetByIDForUpdate(ctx context.Context, tx pgx.Tx, id int64) (*models.Coupon, error) {
	return m.GetByID(ctx, id)
}
func (m *CouponRepo) CountUsagesByIDs(context.Context, []int64) (map[int64]int, error) {
	return map[int64]int{}, nil
}
func (m *CouponRepo) LockByID(ctx context.Context, tx pgx.Tx, id int64) error {
	if m.LockByIDFn != nil {
		return m.LockByIDFn(ctx, tx, id)
	}
	return nil
}
func (m *CouponRepo) CountUsagesTx(ctx context.Context, tx pgx.Tx, couponID int64) (int, error) {
	if m.CountUsagesTxFn != nil {
		return m.CountUsagesTxFn(ctx, tx, couponID)
	}
	return 0, nil
}
func (m *CouponRepo) CountUsagesByUserTx(ctx context.Context, tx pgx.Tx, couponID, userID int64) (int, error) {
	if m.CountUsagesByUserTxFn != nil {
		return m.CountUsagesByUserTxFn(ctx, tx, couponID, userID)
	}
	return 0, nil
}

// ── CouponUsageRepository ────────────────────────────────────────────────────

type CouponUsageRepo struct {
	RecordFn func(ctx context.Context, tx pgx.Tx, couponID, userID, orderID int64, discountApplied float64) error
}

func (m *CouponUsageRepo) Record(ctx context.Context, tx pgx.Tx, couponID, userID, orderID int64, discountApplied float64) error {
	if m.RecordFn != nil {
		return m.RecordFn(ctx, tx, couponID, userID, orderID, discountApplied)
	}
	return nil
}
func (m *CouponUsageRepo) GetByCouponID(context.Context, int64) ([]*models.CouponUsage, error) {
	return nil, nil
}
func (m *CouponUsageRepo) GetByUserID(context.Context, int64) ([]*models.CouponUsage, error) {
	return nil, nil
}

// ── ShippingMethodRepository ─────────────────────────────────────────────────

type ShippingMethodRepo struct {
	GetByIDFn func(ctx context.Context, id int64) (*models.ShippingMethod, error)
}

func (m *ShippingMethodRepo) GetByID(ctx context.Context, id int64) (*models.ShippingMethod, error) {
	if m.GetByIDFn != nil {
		return m.GetByIDFn(ctx, id)
	}
	return &models.ShippingMethod{ID: id}, nil
}
func (m *ShippingMethodRepo) Create(context.Context, int64, models.CreateShippingMethodReq) (*models.ShippingMethod, error) {
	return nil, nil
}
func (m *ShippingMethodRepo) GetByZoneID(context.Context, int64, models.ShippingMethodFilter) ([]*models.ShippingMethod, int64, error) {
	return nil, 0, nil
}
func (m *ShippingMethodRepo) GetAvailable(context.Context, int64, float64) ([]*models.ShippingMethod, error) {
	return nil, nil
}
func (m *ShippingMethodRepo) Update(context.Context, int64, models.UpdateShippingMethodReq) (*models.ShippingMethod, error) {
	return nil, nil
}
func (m *ShippingMethodRepo) Delete(context.Context, int64) error { return nil }

// ── InventoryRepository ──────────────────────────────────────────────────────

type InventoryRepo struct {
	Tx                   pgx.Tx
	GetByVariantFn       func(ctx context.Context, variantID int64) (*models.Inventory, error)
	EnsureForVariantFn   func(ctx context.Context, variantID int64) error
	EnsureForVariantTxFn func(ctx context.Context, tx pgx.Tx, variantID int64) error
	AdjustFn             func(ctx context.Context, tx pgx.Tx, variantID int64, req models.AdjustStockReq, orderID *int64) error
	ReserveFn            func(ctx context.Context, tx pgx.Tx, variantID int64, quantity int, orderID int64) error
	ReleaseFn            func(ctx context.Context, tx pgx.Tx, variantID int64, quantity int, orderID int64) error
	DeductFn             func(ctx context.Context, tx pgx.Tx, variantID int64, quantity int, orderID int64) error
	UpdateReorderFn      func(ctx context.Context, variantID int64, req models.UpdateReorderReq) (*models.Inventory, error)
}

func (m *InventoryRepo) BeginTx(context.Context) (pgx.Tx, error) { return txOr(m.Tx), nil }
func (m *InventoryRepo) Reserve(ctx context.Context, tx pgx.Tx, variantID int64, quantity int, orderID int64) error {
	if m.ReserveFn != nil {
		return m.ReserveFn(ctx, tx, variantID, quantity, orderID)
	}
	return nil
}
func (m *InventoryRepo) Release(ctx context.Context, tx pgx.Tx, variantID int64, quantity int, orderID int64) error {
	if m.ReleaseFn != nil {
		return m.ReleaseFn(ctx, tx, variantID, quantity, orderID)
	}
	return nil
}
func (m *InventoryRepo) Deduct(ctx context.Context, tx pgx.Tx, variantID int64, quantity int, orderID int64) error {
	if m.DeductFn != nil {
		return m.DeductFn(ctx, tx, variantID, quantity, orderID)
	}
	return nil
}

func (m *InventoryRepo) Adjust(ctx context.Context, tx pgx.Tx, variantID int64, req models.AdjustStockReq, orderID *int64) error {
	if m.AdjustFn != nil {
		return m.AdjustFn(ctx, tx, variantID, req, orderID)
	}
	return nil
}
func (m *InventoryRepo) GetByVariantID(ctx context.Context, variantID int64) (*models.Inventory, error) {
	if m.GetByVariantFn != nil {
		return m.GetByVariantFn(ctx, variantID)
	}
	return nil, nil
}
func (m *InventoryRepo) GetAll(context.Context, models.InventoryFilter) ([]*models.Inventory, int64, error) {
	return nil, 0, nil
}
func (m *InventoryRepo) GetLowStock(context.Context) ([]*models.Inventory, error) { return nil, nil }
func (m *InventoryRepo) EnsureForVariant(ctx context.Context, variantID int64) error {
	if m.EnsureForVariantFn != nil {
		return m.EnsureForVariantFn(ctx, variantID)
	}
	return nil
}
func (m *InventoryRepo) EnsureForVariantTx(ctx context.Context, tx pgx.Tx, variantID int64) error {
	if m.EnsureForVariantTxFn != nil {
		return m.EnsureForVariantTxFn(ctx, tx, variantID)
	}
	if m.EnsureForVariantFn != nil {
		return m.EnsureForVariantFn(ctx, variantID)
	}
	return nil
}
func (m *InventoryRepo) UpdateReorder(ctx context.Context, variantID int64, req models.UpdateReorderReq) (*models.Inventory, error) {
	if m.UpdateReorderFn != nil {
		return m.UpdateReorderFn(ctx, variantID, req)
	}
	return nil, nil
}

// ── MovementRepository ───────────────────────────────────────────────────────

type MovementRepo struct {
	GetAllFn       func(context.Context, models.MovementFilter) ([]*models.InventoryMovement, int64, error)
	GetByVariantFn func(context.Context, int64) ([]*models.InventoryMovement, error)
}

func (m *MovementRepo) GetAll(ctx context.Context, filter models.MovementFilter) ([]*models.InventoryMovement, int64, error) {
	if m.GetAllFn != nil {
		return m.GetAllFn(ctx, filter)
	}
	return nil, 0, nil
}
func (m *MovementRepo) GetByVariantID(ctx context.Context, variantID int64) ([]*models.InventoryMovement, error) {
	if m.GetByVariantFn != nil {
		return m.GetByVariantFn(ctx, variantID)
	}
	return nil, nil
}

// ── WalletRepository ─────────────────────────────────────────────────────────

type WalletRepo struct {
	Tx            pgx.Tx
	GetByUserIDFn func(ctx context.Context, userID int64) (*models.Wallet, error)
	GetOrCreateFn func(ctx context.Context, userID int64) (*models.Wallet, error)
	PurchaseFn    func(ctx context.Context, tx pgx.Tx, walletID int64, amount float64, orderID int64) (*models.WalletTransaction, error)
	WithdrawFn    func(ctx context.Context, tx pgx.Tx, walletID int64, amount float64, orderID *int64, description *string) (*models.WalletTransaction, error)
}

func (m *WalletRepo) BeginTx(context.Context) (pgx.Tx, error) { return txOr(m.Tx), nil }
func (m *WalletRepo) GetByUserID(ctx context.Context, userID int64) (*models.Wallet, error) {
	if m.GetByUserIDFn != nil {
		return m.GetByUserIDFn(ctx, userID)
	}
	return &models.Wallet{ID: 1}, nil
}
func (m *WalletRepo) GetOrCreate(ctx context.Context, userID int64) (*models.Wallet, error) {
	if m.GetOrCreateFn != nil {
		return m.GetOrCreateFn(ctx, userID)
	}
	return &models.Wallet{ID: 1}, nil
}
func (m *WalletRepo) Purchase(ctx context.Context, tx pgx.Tx, walletID int64, amount float64, orderID int64) (*models.WalletTransaction, error) {
	if m.PurchaseFn != nil {
		return m.PurchaseFn(ctx, tx, walletID, amount, orderID)
	}
	return &models.WalletTransaction{}, nil
}
func (m *WalletRepo) Withdraw(ctx context.Context, tx pgx.Tx, walletID int64, amount float64, orderID *int64, description *string) (*models.WalletTransaction, error) {
	if m.WithdrawFn != nil {
		return m.WithdrawFn(ctx, tx, walletID, amount, orderID, description)
	}
	return &models.WalletTransaction{}, nil
}
func (m *WalletRepo) Deposit(context.Context, pgx.Tx, int64, float64, *int64, *string) (*models.WalletTransaction, error) {
	return &models.WalletTransaction{}, nil
}
func (m *WalletRepo) Refund(context.Context, pgx.Tx, int64, float64, int64) (*models.WalletTransaction, error) {
	return &models.WalletTransaction{}, nil
}
func (m *WalletRepo) GetTransactions(context.Context, int64, models.WalletTransactionFilter) ([]*models.WalletTransaction, int64, error) {
	return nil, 0, nil
}

// ── PaymentTransactionRepository ─────────────────────────────────────────────

type PaymentRepo struct {
	Tx       pgx.Tx
	GetAllFn func(ctx context.Context, filter models.PaymentTransactionFilter) ([]*models.PaymentTransaction, int64, error)
	CreateFn func(ctx context.Context, tx pgx.Tx, req models.CreatePaymentTransactionReq) (*models.PaymentTransaction, error)
}

func (m *PaymentRepo) BeginTx(context.Context) (pgx.Tx, error) { return txOr(m.Tx), nil }
func (m *PaymentRepo) GetAll(ctx context.Context, filter models.PaymentTransactionFilter) ([]*models.PaymentTransaction, int64, error) {
	if m.GetAllFn != nil {
		return m.GetAllFn(ctx, filter)
	}
	return nil, 0, nil
}
func (m *PaymentRepo) Create(ctx context.Context, tx pgx.Tx, req models.CreatePaymentTransactionReq) (*models.PaymentTransaction, error) {
	if m.CreateFn != nil {
		return m.CreateFn(ctx, tx, req)
	}
	return &models.PaymentTransaction{}, nil
}
func (m *PaymentRepo) GetByID(context.Context, int64) (*models.PaymentTransaction, error) {
	return nil, nil
}
func (m *PaymentRepo) GetByTransactionID(context.Context, string) (*models.PaymentTransaction, error) {
	return nil, nil
}
func (m *PaymentRepo) Confirm(context.Context, pgx.Tx, models.ConfirmPaymentReq) (*models.PaymentTransaction, error) {
	return nil, nil
}
func (m *PaymentRepo) Fail(context.Context, models.FailPaymentReq) (*models.PaymentTransaction, error) {
	return nil, nil
}

// ── Compile-time interface assertions ────────────────────────────────────────

var (
	_ pgx.Tx                                    = (*FakeTx)(nil)
	_ repositories.OrderRepository              = (*OrderRepo)(nil)
	_ repositories.OrderItemRepository          = (*OrderItemRepo)(nil)
	_ repositories.CartRepository               = (*CartRepo)(nil)
	_ repositories.CouponRepository             = (*CouponRepo)(nil)
	_ repositories.CouponUsageRepository        = (*CouponUsageRepo)(nil)
	_ repositories.ShippingMethodRepository     = (*ShippingMethodRepo)(nil)
	_ repositories.InventoryRepository          = (*InventoryRepo)(nil)
	_ repositories.MovementRepository           = (*MovementRepo)(nil)
	_ repositories.WalletRepository             = (*WalletRepo)(nil)
	_ repositories.PaymentTransactionRepository = (*PaymentRepo)(nil)
)
