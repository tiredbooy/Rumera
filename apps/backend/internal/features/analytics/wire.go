package analytics

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tiredbooy/pkg/validator"
)

// Module is the fully-wired analytics feature plus services cron needs.
type Module struct {
	Handler       *Handler
	Events        *EventService
	ProductStats  *DailyProductStatsService
	RevenueStats  *DailyRevenueStatsService
	SearchSummary *SearchSummaryService
}

// New wires analytics repositories → services → HTTP handler against the
// analytics database.
func New(adb *pgxpool.Pool, v *validator.Validator) Module {
	events := NewEventService(NewEventRepository(adb))
	productStats := NewDailyProductStatsService(NewDailyProductStatsRepository(adb))
	revenueStats := NewDailyRevenueStatsService(NewDailyRevenueStatsRepository(adb))
	searchSummary := NewSearchSummaryService(NewSearchSummaryRepository(adb))
	return Module{
		Handler:       NewHandler(events, productStats, revenueStats, searchSummary, v),
		Events:        events,
		ProductStats:  productStats,
		RevenueStats:  revenueStats,
		SearchSummary: searchSummary,
	}
}
