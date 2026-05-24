# Spec — Parse milliseconds into a time-unit breakdown

Derived from the public README of the `parse-ms` library.

```ts
export default function parseMilliseconds(milliseconds: number): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
  microseconds: number;
  nanoseconds: number;
};
```

## Behavior

Decompose a duration given in milliseconds into its component time units. The
returned object always has the seven fields above.

Documented example:

```js
parseMilliseconds(1337000001);
/*
{
  days: 15,
  hours: 11,
  minutes: 23,
  seconds: 20,
  milliseconds: 1,
  microseconds: 0,
  nanoseconds: 0
}
*/
```

The breakdown is the natural one:

- `days` = whole days in the duration
- `hours` = remaining whole hours after removing days (0..23)
- `minutes` = remaining whole minutes (0..59)
- `seconds` = remaining whole seconds (0..59)
- `milliseconds` = remaining whole milliseconds (0..999)
- `microseconds` = the sub-millisecond part expressed in microseconds (0..999)
- `nanoseconds` = the sub-microsecond part expressed in nanoseconds (0..999)

Each value is truncated toward zero (no rounding). Reassembling the parts
reconstructs the (truncated) original duration.

## Inputs / errors

- The argument MUST be a `number`; a non-number throws a `TypeError`.
- Any finite `number` of milliseconds is accepted, including very large
  durations and `0`.

## Invariants

- **Every field is a finite number.** The function never returns `NaN`,
  `Infinity`, or `-Infinity` in any field, for any finite numeric input — no
  matter how large the duration.
- **Sub-unit ranges**: `hours` ∈ [0,24), `minutes`/`seconds` ∈ [0,60),
  `milliseconds`/`microseconds`/`nanoseconds` ∈ [0,1000) (in magnitude), and each
  is an integer.
- **Consistency**: the seven fields together account for the input duration;
  larger inputs only increase the `days` field, never corrupt the sub-second
  fields.
