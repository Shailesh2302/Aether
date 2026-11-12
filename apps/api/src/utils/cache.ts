import { redis } from '../config/redis.js';

const KEY_PREFIX = 'aether:cache:';

interface Entry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Small in-process TTL cache. Cheap to consult before hitting Redis/Neon,
 * and automatically bounded so a million distinct keys cannot exhaust
 * memory in a single API instance.
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, Entry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 10_000
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    // Refresh insertion order for a simple LRU-ish eviction.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}

/** Only talk to Redis when it is actually connected; otherwise the API
 * must not pay a network timeout on every cache lookup. */
function redisReady(): boolean {
  return redis.status === 'ready';
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redisReady()) return null;
  try {
    const raw = await redis.get(`${KEY_PREFIX}${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!redisReady()) return;
  try {
    await redis.set(`${KEY_PREFIX}${key}`, JSON.stringify(value), 'EX', Math.max(1, Math.floor(ttlSeconds)));
  } catch {
    // Caching is best-effort; never fail the request because Redis blipped.
  }
}

export async function cacheDelete(key: string): Promise<void> {
  if (!redisReady()) return;
  try {
    await redis.del(`${KEY_PREFIX}${key}`);
  } catch {
    // best-effort
  }
}

/** Cache helper that checks L1 (process memory) and then Redis. */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
  l1?: TtlCache<T>
): Promise<T> {
  const local = l1?.get(key);
  if (local !== undefined) return local;

  const remote = await cacheGet<T>(key);
  if (remote !== null) {
    l1?.set(key, remote);
    return remote;
  }

  const fresh = await loader();
  l1?.set(key, fresh);
  await cacheSet(key, fresh, ttlSeconds);
  return fresh;
}
