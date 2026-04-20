import { PageShell } from "@/components/page-shell";
import { Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <PageShell title="カード">
      <div className="py-6 flex flex-col gap-4">
        <Skeleton className="h-11 rounded-2xl" />
        <div className="flex gap-2">
          <Skeleton className="w-16 h-8 rounded-full" />
          <Skeleton className="w-16 h-8 rounded-full" />
          <Skeleton className="w-16 h-8 rounded-full" />
          <Skeleton className="w-16 h-8 rounded-full" />
        </div>
        <ul className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </ul>
      </div>
    </PageShell>
  );
}
