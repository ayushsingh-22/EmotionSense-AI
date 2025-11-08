'use client'

import { useCallback, useMemo, useRef, useEffect, useState } from 'react'

// Debounce utility for performance optimization
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Throttle utility for performance optimization
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

// Simple cache implementation
export class SimpleCache<K, V> {
  private cache = new Map<K, V>()
  private maxSize: number

  constructor(maxSize = 100) {
    this.maxSize = maxSize
  }

  get(key: K): V | undefined {
    return this.cache.get(key)
  }

  set(key: K, value: V): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }
    this.cache.set(key, value)
  }

  clear(): void {
    this.cache.clear()
  }
}

// Global cache instance
interface CachedValue<T> {
  data: T;
  timestamp: number;
}

const globalCache = new SimpleCache<string, CachedValue<unknown>>(50)

// Cache wrapper function
export async function withCache<T>(
  key: string,
  factory: () => Promise<T>,
  ttl: number = 5 * 60 * 1000 // 5 minutes default
): Promise<T> {
  const cached = globalCache.get(key)
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data as T
  }

  const data = await factory()
  globalCache.set(key, { data, timestamp: Date.now() })
  return data
}

// Performance monitoring utility
export class PerformanceMonitor {
  private static measurements = new Map<string, number[]>()
  private static startTimes = new Map<string, number>()

  static start(name: string): void {
    if (typeof window !== 'undefined' && window.performance) {
      this.startTimes.set(name, window.performance.now())
      window.performance.mark(`${name}-start`)
    }
  }

  static end(name: string): number {
    if (typeof window !== 'undefined' && window.performance) {
      const startTime = this.startTimes.get(name)
      if (startTime !== undefined) {
        const endTime = window.performance.now()
        const duration = endTime - startTime
        
        window.performance.mark(`${name}-end`)
        
        if (!this.measurements.has(name)) {
          this.measurements.set(name, [])
        }
        this.measurements.get(name)!.push(duration)
        
        this.startTimes.delete(name)
        return duration
      }
    }
    return 0
  }

  static mark(name: string): void {
    if (typeof window !== 'undefined' && window.performance) {
      window.performance.mark(name)
    }
  }

  static measure(name: string, startMark: string, endMark?: string): number {
    if (typeof window !== 'undefined' && window.performance) {
      const end = endMark || `${startMark}-end`
      this.mark(end)

      const entry = window.performance.measure(name, startMark, end)
      const duration = entry.duration

      if (!this.measurements.has(name)) {
        this.measurements.set(name, [])
      }
      this.measurements.get(name)!.push(duration)

      return duration
    }
    return 0
  }

  static getStats(name: string): { avg: number; min: number; max: number; count: number } | null {
    const measurements = this.measurements.get(name)
    if (!measurements || measurements.length === 0) return null

    const avg = measurements.reduce((sum, val) => sum + val, 0) / measurements.length
    const min = Math.min(...measurements)
    const max = Math.max(...measurements)

    return { avg, min, max, count: measurements.length }
  }
}

// Intersection Observer hook for lazy loading
export function useIntersectionObserver(
  elementRef: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = useState(false)

  const observerCallback = useCallback((entries: IntersectionObserverEntry[]) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        setIsIntersecting(true)
      }
    })
  }, [])

  const observer = useMemo(() => {
    if (typeof window !== 'undefined') {
      return new IntersectionObserver(observerCallback, {
        threshold: 0.1,
        ...options
      })
    }
    return null
  }, [observerCallback, options])

  useEffect(() => {
    if (observer && elementRef.current) {
      observer.observe(elementRef.current)
      return () => observer.disconnect()
    }
  }, [observer, elementRef])

  return { isIntersecting }
}

// Memoization hook with key generation
export function useMemoized<T>(
  factory: () => T,
  deps: React.DependencyList,
  keyGenerator?: (deps: React.DependencyList) => string
): T {
  const cache = useRef(new Map<string, T>())
  
  const key = keyGenerator ? keyGenerator(deps) : JSON.stringify(deps)
  
  if (cache.current.has(key)) {
    return cache.current.get(key)!
  }
  
  const result = factory()
  cache.current.set(key, result)
  
  // Clean old entries if cache gets too large
  if (cache.current.size > 50) {
    const firstKey = cache.current.keys().next().value
    if (firstKey !== undefined) {
      cache.current.delete(firstKey)
    }
  }
  
  return result
}

// Virtual scrolling hook for large lists
export function useVirtualScrolling<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number
) {
  const [scrollTop, setScrollTop] = useState(0)
  
  const visibleStart = Math.floor(scrollTop / itemHeight)
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight),
    items.length - 1
  )
  
  const visibleItems = items.slice(visibleStart, visibleEnd + 1)
  const totalHeight = items.length * itemHeight
  const offsetY = visibleStart * itemHeight
  
  return {
    visibleItems,
    totalHeight,
    offsetY,
    setScrollTop
  }
}

// Performance optimized callback
export function useOptimizedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  deps: React.DependencyList,
  delay = 0
): T {
  const debouncedCallback = useMemo(
    () => delay > 0 ? debounce(callback, delay) : callback,
    [...deps, callback, delay]
  )
  
  return useCallback(debouncedCallback, [debouncedCallback]) as T
}