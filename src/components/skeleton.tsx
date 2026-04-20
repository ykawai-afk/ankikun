import { type HTMLAttributes } from "react";

export function Skeleton({
  className = "",
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={`relative overflow-hidden rounded-xl bg-surface-2 ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.3s_infinite] bg-gradient-to-r from-transparent via-border/60 to-transparent" />
    </div>
  );
}
