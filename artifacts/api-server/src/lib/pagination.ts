// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { z } from "zod";

export const paginationQuerySchema = z.object({
  limit:  z.coerce.number().int().min(1).max(250).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function parsePagination(query: Record<string, unknown>): PaginationQuery {
  return paginationQuerySchema.parse(query);
}

export function paginationMeta(total: number, { limit, offset }: PaginationQuery) {
  return {
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
    page: Math.floor(offset / limit) + 1,
    pages: Math.ceil(total / limit),
  };
}
