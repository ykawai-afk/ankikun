import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

// Supabase / PostgREST silently caps `.select()` responses at 1000 rows.
// Any aggregation that materializes rows past that point quietly under-
// reports — the symptom we hit was 累計レビュー数 stuck at 1000 and
// every distribution under-counting. selectAll re-runs the same query
// in 1000-row windows via .range() until a short page proves we've
// drained the result set.
//
// Pass a thunk that returns a *fresh* query each call: PostgREST builders
// are mutable, so applying .range twice on the same builder doesn't work.
const PAGE_SIZE = 1000;

type PageThenable<T> = PromiseLike<{ data: T[] | null; error: unknown }> & {
  range: (from: number, to: number) => PageThenable<T>;
};

export async function selectAll<T>(build: () => PageThenable<T>): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}
