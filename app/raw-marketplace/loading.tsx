// Instant skeleton shown by Next.js while raw-marketplace/page.tsx loads
export default function RawMarketplaceLoading() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--lux-bg, #f5ede0)' }}>
      {/* Navbar placeholder */}
      <div className="h-16 border-b" style={{ background: 'rgba(0,0,0,0.03)' }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-6">
          <div className="h-8 w-52 rounded-lg bg-current opacity-10 animate-pulse" />
          <div className="h-10 w-36 rounded-xl bg-current opacity-10 animate-pulse" />
        </div>

        {/* Filter row skeleton */}
        <div className="flex flex-wrap gap-2 mb-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-9 w-28 rounded-xl bg-current opacity-10 animate-pulse" />
          ))}
          <div className="h-9 w-40 rounded-xl bg-current opacity-10 animate-pulse" />
        </div>

        {/* Listing cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border p-5 space-y-3" style={{ borderColor: 'rgba(0,0,0,0.08)', animationDelay: `${i * 80}ms` }}>
              <div className="flex justify-between items-start">
                <div className="h-5 w-36 rounded bg-current opacity-10 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                <div className="h-5 w-16 rounded-full bg-current opacity-10 animate-pulse" />
              </div>
              <div className="h-4 w-24 rounded bg-current opacity-10 animate-pulse" style={{ animationDelay: `${i * 80 + 30}ms` }} />
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="h-10 rounded-lg bg-current opacity-10 animate-pulse" />
                <div className="h-10 rounded-lg bg-current opacity-10 animate-pulse" />
              </div>
              <div className="flex gap-2 pt-1">
                <div className="h-9 flex-1 rounded-xl bg-current opacity-10 animate-pulse" />
                <div className="h-9 flex-1 rounded-xl bg-current opacity-10 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
