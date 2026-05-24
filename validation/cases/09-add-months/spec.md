# Spec — Add calendar months to a date

```ts
export function addMonths(iso: string, n: number): string; // iso = "YYYY-MM-DD"
```

## Behavior

Return the date `n` calendar months after `iso` (n may be negative or zero), as
`"YYYY-MM-DD"`. **End-of-month clamping**: if the resulting day does not exist in
the target month, clamp to the **last valid day** of that month — do NOT overflow
into the following month.

All arithmetic is on the calendar date in UTC; there is no time-of-day and no
time-zone component.

## Worked examples (define the clamping semantics exactly)

| call | result | why |
|---|---|---|
| `addMonths("2021-01-15", 1)` | `2021-02-15` | day exists |
| `addMonths("2021-01-31", 1)` | `2021-02-28` | Feb has no 31st → clamp to 28 |
| `addMonths("2020-01-31", 1)` | `2020-02-29` | 2020 is a leap year → clamp to 29 |
| `addMonths("2021-03-31", -1)` | `2021-02-28` | clamp also applies going backward |
| `addMonths("2021-12-31", 1)` | `2022-01-31` | year rolls over; Jan has 31 |
| `addMonths("2021-05-20", 0)` | `2021-05-20` | identity |
| `addMonths("2021-10-31", -8)` | `2021-02-28` | clamp after a multi-month shift |

## Edge cases / errors

- Malformed `iso` (not a real `YYYY-MM-DD` calendar date) or non-integer `n` →
  throw. Never return a malformed/overflowed date silently.

## Invariants

- **No overflow**: the result's month is always exactly `(startMonth + n)` mod 12
  (with year carry); the day never spills into the next month.
- **Day ≤ start day**: `resultDay <= min(startDay, daysInResultMonth)`; and
  `resultDay == startDay` whenever the target month has at least `startDay` days.
- **Round-trip-ish**: for a start day ≤ 28, `addMonths(addMonths(d, n), -n) == d`
  (days 29–31 may not round-trip due to clamping — do not assert it there).
- **Monotonic**: increasing `n` never moves the result earlier.
