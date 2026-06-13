package models

type BaseFilter struct {
	PaginationParams
	SortBy  string `query:"sortBy"`
	OrderBy string `query:"orderBy"`
	Search  string `query:"search"`
}

func (f *BaseFilter) Defaults(defaultSort string) {
	if f.Page < 1 {
		f.Page = 1
	}
	if f.Limit < 1 || f.Limit > 100 {
		f.Limit = 20
	}
	if f.SortBy == "" {
		f.SortBy = defaultSort
	}
	if f.OrderBy == "" {
		f.OrderBy = "desc"
	}
}
