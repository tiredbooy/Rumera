/** Success envelope returned by Go `response.Success`. */
export interface ApiSuccess<T> {
  data: T;
  message?: string;
}

/** Field-level validation errors keyed by request field name. */
export type ApiFieldErrors = Record<string, string[]>;

export interface ApiErrorBody {
  code: string;
  message: string;
  fields?: ApiFieldErrors;
}

/** Error envelope returned by Go `response.Error`. */
export interface ApiErrorEnvelope {
  error: ApiErrorBody;
}

/** Metadata returned by Go `response.Paginated`. */
export interface Pagination {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

/** Paginated responses are top-level and are not wrapped in `data`. */
export interface Paginated<T> {
  results: T[];
  pagination: Pagination;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export type ApiQueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly (string | number)[];

export type ApiQueryParams = Record<string, ApiQueryValue>;
