import { PageShell } from "@/components/page-shell";
import { Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <PageShell title="進捗">
      <div className="py-4 flex flex-col gap-5 pb-8">
        <Skeleton className="aspect-square rounded-2xl" />
        <Skeleton className="h-2 rounded-full" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </PageShell>
  );
}
