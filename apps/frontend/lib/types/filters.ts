export interface BaseFilter {
  page?: number;
  limit?: number;
  sortBy?: string;
  orderBy?: string;
  search?: string;
}

export function applyDefaults(filter: BaseFilter, defaultSort: string): void {
  filter.page ??= 1;
  filter.limit ??= 20;
  filter.sortBy ??= defaultSort;
  filter.orderBy ??= "desc";
}
