/**
 * Performance optimization utilities
 * Handles caching, debouncing, and other performance improvements
 */

// Cache for API responses
const apiCache = new Map<string, { data: unknown; timestamp: number }>();

// Debounce utility
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle utility
export function throttle<T extends (...args: unknown[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Cache wrapper for API calls
export function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = 5 * 60 * 1000 // 5 minutes default
): Promise<T> {
  const cached = apiCache.get(key);
  if (cached && Date.now() - cached.timestamp < ttlMs) {
    return Promise.resolve(cached.data as T);
  }

  return fetcher().then(result => {
    apiCache.set(key, { data: result, timestamp: Date.now() });
    return result;
  });
}

// Performance monitor
export class PerformanceMonitor {
  private static marks: Map<string, number> = new Map();

  static start(label: string) {
    this.marks.set(label, performance.now());
  }

  static end(label: string): number {
    const start = this.marks.get(label);
    if (!start) return 0;
    
    const duration = performance.now() - start;
    console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
    this.marks.delete(label);
    return duration;
  }
}

// Optimize component re-renders
export function areEqual(prevProps: Record<string, unknown>, nextProps: Record<string, unknown>): boolean {
  return JSON.stringify(prevProps) === JSON.stringify(nextProps);
}

// Lazy loading utility
export function createLazyComponent<T>(
  importFn: () => Promise<{ default: T }>
) {
  let component: T | null = null;
  let promise: Promise<T> | null = null;

  return () => {
    if (component) return Promise.resolve(component);
    if (promise) return promise;

    promise = importFn().then(module => {
      component = module.default;
      return component;
    });

    return promise;
  };
}