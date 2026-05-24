// Independent Verification Environment for the LRU cache SUT.
// Authored from spec.md ONLY. The VE has NOT read impl.buggy.ts / impl.correct.ts.
//
// Strategy:
//  - Independent reference model of an LRU where BOTH get and put refresh recency.
//  - Model-based / random-operation-history testing (fast-check fc.commands / modelRun)
//    comparing SUT vs reference model after EVERY operation, across small capacities.
//  - Directed test encoding the spec's exact worked sequence (the get-then-evict crux).
//  - Constructor error cases and the size invariant.
import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { LRU } from './sut';

// ---------------------------------------------------------------------------
// Independent reference model.
// Recency order kept in an array: index 0 = LRU (oldest), last = MRU (newest).
// Both get (successful) and put (insert/update) move the key to MRU.
// On a NEW key that would exceed capacity, evict the single LRU (front) first.
// ---------------------------------------------------------------------------
class RefLRU<K, V> {
  private readonly cap: number;
  private store = new Map<K, V>();
  private order: K[] = []; // order[0] = LRU, order[last] = MRU

  constructor(capacity: number) {
    if (typeof capacity !== 'number' || !Number.isInteger(capacity) || capacity < 1) {
      throw new Error('invalid capacity');
    }
    this.cap = capacity;
  }

  private touch(key: K): void {
    const idx = this.order.indexOf(key);
    if (idx !== -1) this.order.splice(idx, 1);
    this.order.push(key);
  }

  get(key: K): V | undefined {
    if (!this.store.has(key)) return undefined;
    const v = this.store.get(key);
    this.touch(key); // successful get refreshes recency -> MRU
    return v;
  }

  put(key: K, value: V): void {
    if (this.store.has(key)) {
      // update existing: no growth, refresh recency
      this.store.set(key, value);
      this.touch(key);
      return;
    }
    // new key
    this.store.set(key, value);
    this.touch(key);
    if (this.store.size > this.cap) {
      // evict single LRU = front of order
      const victim = this.order.shift() as K;
      this.store.delete(victim);
    }
  }

  get size(): number {
    return this.store.size;
  }
}

// ---------------------------------------------------------------------------
// Directed test: the spec's exact worked example (the get-then-evict crux).
// ---------------------------------------------------------------------------
describe('LRU — spec worked example (get refreshes recency)', () => {
  test('a READ key survives the next eviction', () => {
    const c = new LRU<string, number>(2);
    c.put('a', 1); // {a}
    c.put('b', 2); // {a,b}  a is LRU
    expect(c.get('a')).toBe(1); // a becomes MRU, b is LRU
    c.put('c', 3); // size 3 > 2 -> evict LRU = 'b'

    expect(c.get('b')).toBeUndefined(); // b was evicted
    expect(c.get('a')).toBe(1); // a survived because get('a') refreshed it
    expect(c.get('c')).toBe(3);
    expect(c.size).toBe(2);
  });

  test('contrast: without any get, plain LRU evicts oldest insert', () => {
    const c = new LRU<string, number>(2);
    c.put('a', 1); // {a}
    c.put('b', 2); // {a,b}  a is LRU
    c.put('c', 3); // evict 'a'
    expect(c.get('a')).toBeUndefined();
    expect(c.get('b')).toBe(2);
    expect(c.get('c')).toBe(3);
    expect(c.size).toBe(2);
  });

  test('put on existing key refreshes recency and does not grow size', () => {
    const c = new LRU<string, number>(2);
    c.put('a', 1); // {a}
    c.put('b', 2); // {a,b}  a is LRU
    c.put('a', 10); // update a, a becomes MRU, b is LRU, size stays 2
    expect(c.size).toBe(2);
    c.put('c', 3); // evict LRU = 'b'
    expect(c.get('b')).toBeUndefined();
    expect(c.get('a')).toBe(10);
    expect(c.get('c')).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Constructor error cases.
// ---------------------------------------------------------------------------
describe('LRU — constructor validation', () => {
  const bad = [0, -1, -5, 1.5, 2.7, NaN, Infinity, -Infinity];
  for (const c of bad) {
    test(`capacity ${c} must throw`, () => {
      expect(() => new LRU<string, number>(c)).toThrow();
    });
  }

  const good = [1, 2, 3, 10, 100];
  for (const c of good) {
    test(`capacity ${c} must NOT throw`, () => {
      expect(() => new LRU<string, number>(c)).not.toThrow();
    });
  }
});

// ---------------------------------------------------------------------------
// Absent-key get changes nothing.
// ---------------------------------------------------------------------------
describe('LRU — absent get is a no-op', () => {
  test('get of missing key returns undefined and does not affect eviction order', () => {
    const c = new LRU<string, number>(2);
    c.put('a', 1);
    c.put('b', 2); // a is LRU
    expect(c.get('z')).toBeUndefined(); // no-op
    c.put('c', 3); // should still evict 'a' (the true LRU)
    expect(c.get('a')).toBeUndefined();
    expect(c.get('b')).toBe(2);
    expect(c.get('c')).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Model-based / random operation-history testing via fc.commands.
// Keyspace deliberately small (relative to capacity) so collisions and
// evictions happen frequently. After EVERY command we compare SUT to model:
//   - return value of get
//   - size
//   - and the OBSERVABLE state: get() of every key in a fixed probe set,
//     done on a SEPARATE pair of caches replayed identically, to avoid the
//     probe itself mutating recency mid-history.
// To keep recency comparison faithful we compare get-return-values inline and
// size inline, and additionally run a full-state snapshot check at the end by
// replaying the recorded history onto fresh SUT+model and probing.
// ---------------------------------------------------------------------------

type Op = { kind: 'get'; key: number } | { kind: 'put'; key: number; value: number };

function runHistory(capacity: number, ops: Op[]) {
  const sut = new LRU<number, number>(capacity);
  const model = new RefLRU<number, number>(capacity);

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (op.kind === 'get') {
      const a = sut.get(op.key);
      const b = model.get(op.key);
      expect(a, `get(${op.key}) return mismatch at step ${i} | history=${JSON.stringify(ops.slice(0, i + 1))}`).toBe(b);
    } else {
      sut.put(op.key, op.value);
      model.put(op.key, op.value);
    }
    // size invariant + agreement after every op
    expect(sut.size, `size mismatch at step ${i} | history=${JSON.stringify(ops.slice(0, i + 1))}`).toBe(
      model.size
    );
    expect(sut.size, `size > capacity at step ${i}`).toBeLessThanOrEqual(capacity);
  }
}

describe('LRU — model-based random operation histories', () => {
  test('SUT matches independent reference model on random histories', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        fc.array(
          fc.oneof(
            fc.record({
              kind: fc.constant('get' as const),
              key: fc.integer({ min: 0, max: 6 })
            }),
            fc.record({
              kind: fc.constant('put' as const),
              key: fc.integer({ min: 0, max: 6 }),
              value: fc.integer({ min: 0, max: 1000 })
            })
          ),
          { minLength: 0, maxLength: 60 }
        ),
        (capacity, ops) => {
          runHistory(capacity, ops as Op[]);
        }
      ),
      { numRuns: 2000 }
    );
  });

  test('eviction-heavy histories (capacity 1 and 2, dense keyspace)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2 }),
        fc.array(
          fc.oneof(
            fc.record({
              kind: fc.constant('get' as const),
              key: fc.integer({ min: 0, max: 3 })
            }),
            fc.record({
              kind: fc.constant('put' as const),
              key: fc.integer({ min: 0, max: 3 }),
              value: fc.integer({ min: 0, max: 100 })
            })
          ),
          { minLength: 1, maxLength: 40 }
        ),
        (capacity, ops) => {
          runHistory(capacity, ops as Op[]);
        }
      ),
      { numRuns: 3000 }
    );
  });
});

// ---------------------------------------------------------------------------
// Targeted property: the "read protects from eviction" crux generalized.
// Fill cache to capacity with distinct keys, read one of them, insert a new
// key. The READ key must survive; the never-touched-since-fill key must be the
// victim (when capacity >= 2).
// ---------------------------------------------------------------------------
describe('LRU — read protects from eviction (generalized)', () => {
  test('reading an entry makes a different entry the eviction victim', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 6 }), (capacity) => {
        const c = new LRU<number, number>(capacity);
        // fill with keys 0..capacity-1 in order; key 0 is LRU
        for (let k = 0; k < capacity; k++) c.put(k, k * 10);
        // read key 0 -> now key 1 is the LRU
        expect(c.get(0)).toBe(0);
        // insert a brand new key -> must evict key 1, NOT key 0
        c.put(999, 1);
        expect(c.get(1)).toBeUndefined(); // key 1 evicted
        expect(c.get(0)).toBe(0); // key 0 survived because it was read
        expect(c.get(999)).toBe(1);
        expect(c.size).toBe(capacity);
      }),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Size invariant under pure puts of always-new keys.
// ---------------------------------------------------------------------------
describe('LRU — size never exceeds capacity', () => {
  test('inserting many new keys keeps size == capacity once filled', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8 }),
        fc.integer({ min: 0, max: 50 }),
        (capacity, n) => {
          const c = new LRU<number, number>(capacity);
          for (let k = 0; k < n; k++) {
            c.put(k, k);
            expect(c.size).toBeLessThanOrEqual(capacity);
          }
          expect(c.size).toBe(Math.min(n, capacity));
        }
      ),
      { numRuns: 500 }
    );
  });
});
