import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type PageLoaderProps = {
  message?: string;
  className?: string;
  fullScreen?: boolean;
};

export function PageLoader({
  message = "Loading...",
  className,
  fullScreen = false,
}: PageLoaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4",
        fullScreen ? "min-h-screen w-full" : "min-h-[200px] w-full py-12",
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
    </div>
  );
}

export function AdminAuthLoading() {
  // Check for cached profile to speed up display
  const cachedProfile = typeof window !== 'undefined' ? localStorage.getItem('auth_profile_cache') : null;
  const hasCachedData = !!cachedProfile;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 border-r bg-card p-6 lg:block">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-muted" />
        <div className="mt-8 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-xl bg-muted" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      </aside>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <div className="relative">
          <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
        <p className="font-medium text-muted-foreground">
          {hasCachedData ? "Loading your workspace..." : "Authenticating..."}
        </p>
        {!hasCachedData && (
          <p className="text-xs text-muted-foreground">This may take a moment on first load</p>
        )}
      </div>
    </div>
  );
}
