interface CacheEntry<V> {
  value: V
  expireAt: number
}

export class TTLCache<K, V> {
  private readonly cache = new Map<K, CacheEntry<V>>()

  get(key: K): V | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (entry.expireAt <= Date.now()) {
      this.cache.delete(key)
      return null
    }
    return entry.value
  }

  set(key: K, value: V, ttlMs: number): void {
    this.cache.set(key, {
      value,
      expireAt: Date.now() + ttlMs,
    })
  }

  delete(key: K): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }
}
