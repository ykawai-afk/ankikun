import { Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col flex-1 min-h-svh">
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto flex items-center gap-3 h-14 px-5">
          <Skeleton className="w-9 h-9 rounded-full" />
          <Skeleton className="flex-1 h-1 rounded-full" />
          <Skeleton className="w-10 h-3 rounded" />
        </div>
      </div>
      <main className="flex-1 max-w-2xl mx-auto w-full px-5 pb-40 flex flex-col items-center justify-center gap-6 py-10">
        <Skeleton className="w-56 h-14 rounded-2xl" />
        <Skeleton className="w-24 h-4 rounded" />
        <Skeleton className="w-20 h-5 rounded-full" />
      </main>
      <div className="fixed bottom-16 left-0 right-0 z-20 pt-8 pb-4">
        <div className="max-w-2xl mx-auto px-5">
          <Skeleton className="h-14 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
