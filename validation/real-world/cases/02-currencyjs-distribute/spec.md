# Spec — Currency value with `distribute(count)`

Derived from the public README/JSDoc of the `currency.js` library. The default
export is a factory that wraps a monetary value and offers exact, floating-point-
safe arithmetic. This spec focuses on the `distribute` method.

```ts
declare function currency(value: number | string | currency, opts?: object): currency;

interface currency {
  value: number;     // the decimal value, e.g. 1.23
  intValue: number;  // the value in minor units (cents), e.g. 123
  add(n: number | string | currency): currency;
  subtract(n: number | string | currency): currency;
  distribute(count: number): currency[];
  // ...formatting/other methods omitted...
}
```

## Construction

`currency(value)` accepts a number, a string, or another `currency`. Default
precision is 2 decimal places. The value is stored internally as an integer
number of minor units (`intValue`, e.g. cents) so that arithmetic avoids binary
floating-point error.

```js
currency(123);     // value 123.00
currency(1.23);    // value 1.23
currency("$12.30");// value 12.30
```

## `distribute(count)`

> Takes the currency amount and distributes the value as evenly as possible into
> `count` parts. Any extra minor units (pennies) left over from the division are
> stacked onto the first entries.

Returns an **array of `count`** `currency` objects.

Documented example:

```js
currency(1.12).distribute(5); // [0.23, 0.23, 0.22, 0.22, 0.22]
```

So `1.12` over 5 parts gives two parts of `0.23` and three of `0.22` — the two
leftover pennies (112 = 5·22 + 2) are placed on the first two parts.

## Invariants

- **Conservation (the defining property)**: the parts sum back to the original
  amount exactly. `sum(currency(amount).distribute(count)) === amount` for any
  representable monetary `amount` and any integer `count >= 1`. No money is
  created or destroyed by distribution.
- **Length**: `distribute(count)` returns exactly `count` parts.
- **Even split**: every part differs from every other part by at most one minor
  unit (one penny). The leftover minor units (`|intValue| mod count` of them) are
  the only parts that differ, and they are the first ones.
- **Sign consistency**: distributing an amount must not change its sign — the
  parts of a distribution have the same sign as the original amount (or are
  zero); the total must equal the original in both magnitude AND sign.

## Notes

`amount` may be any monetary value the library can represent at the default
precision of 2 (whole dollars, sub-dollar amounts, and so on). `count` is a
positive integer.
