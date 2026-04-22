// Server-side cache tags used across Next's `unstable_cache` wrappers and
// `revalidateTag` calls from actions. Keeping them in one place so every
// mutation invalidates the right slice without stale strings drifting
// across files.

export const CACHE_TAGS = {
  cards: "ankikun-cards",
  reviewLogs: "ankikun-review-logs",
  ingestions: "ankikun-ingestions",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];
