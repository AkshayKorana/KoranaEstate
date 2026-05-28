// Instant skeleton shown by Next.js while store/page.tsx loads
export default function StoreLoading() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--lux-bg, #f5ede0)' }}>
      {/* Navbar placeholder */}
      <div className="h-16 border-b" style={{ background: 'rgba(0,0,0,0.03)' }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-6">
          <div className="h-8 w-48 rounded-lg bg-current opacity-10 animate-pulse" />
          <div className="h-10 w-32 rounded-xl bg-current opacity-10 animate-pulse" />
        </div>

        {/* Category filter skeleton */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-9 w-28 flex-shrink-0 rounded-xl bg-current opacity-10 animate-pulse" />
          ))}
        </div>

        {/* Product cards skeleton grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl border overflow-hidden" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
              {/* Image placeholder */}
              <div className="h-44 bg-current opacity-10 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
              <div className="p-4 space-y-3">
                <div className="h-4 w-3/4 rounded bg-current opacity-10 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
                <div className="h-3 w-1/2 rounded bg-current opacity-10 animate-pulse" style={{ animationDelay: `${i * 60 + 30}ms` }} />
                <div className="flex justify-between items-center pt-1">
                  <div className="h-5 w-20 rounded bg-current opacity-10 animate-pulse" />
                  <div className="h-8 w-24 rounded-lg bg-current opacity-10 animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
