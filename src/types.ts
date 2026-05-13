export interface PaginatedResponse<T> {
  total: number | null;
  count: number;
  offset: number;
  items: T[];
  has_more: boolean;
  next_offset?: number;
}
