package coupons

import (
	"context"
	"testing"
)

func TestDeleteByOrderTx_ZeroOrderIDIsNoop(t *testing.T) {
	t.Parallel()
	repo := &usageRepository{}
	if err := repo.DeleteByOrderTx(context.Background(), nil, 0); err != nil {
		t.Fatalf("DeleteByOrderTx(0) = %v; want nil", err)
	}
}

var _ UsageRepository = (*usageRepository)(nil)
