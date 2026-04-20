import { PageShell } from "@/components/page-shell";
import { Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <PageShell>
      <div className="py-6 flex flex-col gap-7">
        <section className="flex items-center gap-3">
          <Skeleton className="w-24 h-12 rounded-full" />
          <Skeleton className="flex-1 h-16 rounded-2xl" />
        </section>
        <section className="flex flex-col items-start gap-1 pt-2">
          <Skeleton className="w-16 h-3 rounded" />
          <Skeleton className="w-40 h-20 mt-2 rounded-xl" />
        </section>
        <Skeleton className="h-16 rounded-3xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <section className="grid grid-cols-3 gap-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </section>
        <Skeleton className="h-36 rounded-2xl" />
      </div>
    </PageShell>
  );
}
