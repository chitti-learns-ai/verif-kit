# Spec — LRU (least-recently-used) cache

```ts
export class LRU<K, V> {
  constructor(capacity: number);
  get(key: K): V | undefined;
  put(key: K, value: V): void;
  get size(): number;
}
```

## Behavior

A fixed-capacity cache that evicts the **least-recently-used** entry when it
would exceed capacity.

- `constructor(capacity)`: `capacity` must be an integer ≥ 1, else throw.
- `get(key)`: returns the value if present (else `undefined`). **A successful
  `get` counts as a use and makes that key the most-recently-used.**
- `put(key, value)`: inserts or updates. The key becomes most-recently-used.
  If inserting a NEW key makes `size` exceed `capacity`, evict the single
  least-recently-used key first.
- `size`: number of entries currently stored.

**Both `get` and `put` are "uses"** that refresh recency. This is the crux: a
key you recently READ must not be the one evicted.

## Worked example (defines the recency semantics)

```ts
const c = new LRU<string, number>(2);
c.put('a', 1);       // {a}
c.put('b', 2);       // {a,b}      (a is LRU)
c.get('a');          // returns 1; now a is MRU, b is LRU
c.put('c', 3);       // size would be 3 > 2 -> evict LRU = 'b'
c.get('b');          // undefined  (b was evicted)
c.get('a');          // 1          (a survived because get('a') refreshed it)
c.get('c');          // 3
c.size;              // 2
```

If `get` did NOT refresh recency, `put('c',3)` would wrongly evict `'a'` and the
last three lines would be `1?` no — `get('a')` would return `undefined` and
`get('b')` would return `2`. That outcome is INCORRECT per this spec.

## Edge cases / errors

- `new LRU(0)` or non-integer capacity → throw.
- Updating an existing key via `put` does not grow size and refreshes recency.
- `get` of an absent key returns `undefined` and changes nothing.

## Invariants

- `size <= capacity` always.
- After any successful `get(k)` or `put(k,_)`, `k` is the most-recently-used and
  is therefore the LAST to be evicted among current keys.
- Reading a key (`get`) protects it from the next eviction just as writing does.
