import type { ReviewListQuery } from "./types";

export const reviewKeys = {
  all: ["reviews"] as const,
  mine: ["reviews", "mine"] as const,
  pending: ["reviews", "pending"] as const,
  admin: (query: ReviewListQuery = {}) =>
    ["reviews", "admin", query] as const,
};
