// Lightweight navbar skeleton for faster perceived load time.
// No hooks or browser APIs: usable from Server Components (layout Suspense fallback) and Client Components (dynamic loading).
export function NavbarSkeleton() {
  return (
    <div className="h-16 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 fixed top-0 w-full z-40">
      <div className="container flex h-16 items-center justify-between px-4" style={{ maxWidth: '100%' }}>
        <div className="flex items-center gap-2">
          <div className="w-32 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  );
}
