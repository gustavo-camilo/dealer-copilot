import { cn } from './cn';

/** Placeholder block with a soft shimmer, used while data loads. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-shimmer rounded-lg bg-[length:200%_100%]',
        'bg-[linear-gradient(90deg,rgb(var(--surface-2))_0%,rgb(var(--line))_50%,rgb(var(--surface-2))_100%)]',
        className
      )}
    />
  );
}

/** Full-page quiet loader for route-level Suspense and auth checks. */
export function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading">
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-accent" />
      </span>
    </div>
  );
}
