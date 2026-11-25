/** Tiny TTL cache for public, identical-for-everyone data (e.g. the catalogue of one village). */
export class TtlCache<V> {
  private readonly m = new Map<string, { at: number; v: Promise<V> }>();
  constructor(
    private readonly ttlMs: number,
    private readonly max = 200,
  ) {}

  get(key: string, load: () => Promise<V>): Promise<V> {
    const hit = this.m.get(key);
    if (hit && Date.now() - hit.at < this.ttlMs) return hit.v;
    const v = load();
    this.m.set(key, { at: Date.now(), v });
    // Failed loads must not be cached.
    v.catch(() => this.m.delete(key));
    if (this.m.size > this.max) this.m.delete(this.m.keys().next().value as string);
    return v;
  }

  clear(): void {
    this.m.clear();
  }
}
