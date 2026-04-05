export function MarketSkeleton() {
  return (
    <div className="min-h-screen bg-cream">
      {/* Header Skeleton */}
      <header className="border-b border-stone-border bg-cream sticky top-0 z-10">
        <div className="px-6 sm:px-12 py-4">
          <div className="flex items-center justify-between">
            <div className="h-4 w-24 bg-stone-border rounded animate-pulse" />
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="h-4 w-16 bg-stone-border rounded animate-pulse" />
              <div className="h-4 w-12 bg-stone-border rounded animate-pulse" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-2 sm:px-12 py-8 sm:py-12">
        <div className="w-full">
          {/* Title Skeleton */}
          <div className="mb-8 sm:mb-12">
            <div className="h-10 w-3/4 max-w-2xl bg-stone-border rounded animate-pulse mb-3" />
            <div className="h-5 w-1/2 max-w-md bg-stone-border rounded animate-pulse" />
          </div>

          {/* Ecosystem Stats Skeleton */}
          <div className="mb-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-white border border-stone-border rounded-lg p-4 sm:p-6"
                >
                  <div className="h-4 w-20 bg-stone-border rounded animate-pulse mb-2" />
                  <div className="h-8 w-16 bg-stone-border rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          {/* Chart Section Skeletons */}
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="mb-12">
              {/* Section Title */}
              <div className="mb-6">
                <div className="h-6 w-64 bg-stone-border rounded animate-pulse mb-2" />
                <div className="h-4 w-96 max-w-full bg-stone-border rounded animate-pulse" />
              </div>
              {/* Chart Placeholder */}
              <div className="bg-white border border-stone-border rounded-lg p-6 sm:p-8">
                <div className="h-96 w-full bg-stone-border/30 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
