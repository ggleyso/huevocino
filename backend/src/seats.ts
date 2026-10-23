export interface SeatInfo {
  identity: string;
  name: string;
  joinedAt: number;
  lastSeen: number;
}

const IDLE_EVICT_MS = 120_000;
const ABANDON_ACTIVE_MS = 600_000;

export class SeatMap {
  private seats = new Map<string, SeatInfo>();

  constructor(private cap = 4) {}

  private touch(identity: string, name: string) {
    const now = Date.now();
    const s = this.seats.get(identity);
    if (s) {
      s.lastSeen = now;
      s.name = name;
    } else {
      this.seats.set(identity, { identity, name, joinedAt: now, lastSeen: now });
    }
  }

  evict(hasActive: (identity: string) => boolean) {
    const now = Date.now();
    for (const [id, s] of this.seats) {
      const stale = now - s.lastSeen;
      if (!hasActive(id) && stale > IDLE_EVICT_MS) this.seats.delete(id);
      else if (hasActive(id) && stale > ABANDON_ACTIVE_MS) this.seats.delete(id);
    }
  }

  ensure(identity: string, name: string, hasActive: (identity: string) => boolean) {
    this.evict(hasActive);
    if (!this.seats.has(identity) && this.seats.size >= this.cap) {
      throw new Error(`Стол занят (${this.seats.size}/${this.cap})`);
    }
    this.touch(identity, name);
  }

  heartbeat(identity: string, name: string) {
    if (this.seats.has(identity)) this.touch(identity, name);
  }

  leave(identity: string) {
    this.seats.delete(identity);
  }

  list(): SeatInfo[] {
    return [...this.seats.values()];
  }

  has(identity: string): boolean {
    return this.seats.has(identity);
  }
}
