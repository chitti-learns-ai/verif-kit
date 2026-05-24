# Spec — `ms`: convert time strings to/from milliseconds

Derived from the public README of the `ms` library.

```ts
export default function ms(value: string): number;            // string -> ms
export default function ms(value: number, opts?: { long?: boolean }): string; // ms -> string
```

## Behavior

`ms` converts between human time strings and a number of milliseconds.

- **String → number**: given a string containing a number and an optional unit,
  return the equivalent number of milliseconds. With no unit the number is taken
  as milliseconds.
- **Number → string**: given a number of milliseconds, return a short string
  (or a long verbose string when `{ long: true }`).

This spec focuses on the **string → number** direction.

## Documented examples

```js
ms('2 days')  // 172800000
ms('1d')      // 86400000
ms('10h')     // 36000000
ms('2.5 hrs') // 9000000
ms('2h')      // 7200000
ms('1m')      // 60000
ms('5s')      // 5000
ms('1y')      // 31557600000
ms('100')     // 100
ms('-3 days') // -259200000
ms('-1h')     // -3600000
ms('-200')    // -200
```

## Units

Recognized (case-insensitive) units: years (`y`), weeks (`w`), days (`d`),
hours (`h`/`hr`/`hrs`), minutes (`m`/`min`/`mins`), seconds (`s`/`sec`/`secs`),
milliseconds (`ms`/`msec`/`msecs`). A unit may be written in full or abbreviated,
singular or plural, with or without a space before it. A year is 365.25 days; a
week is 7 days.

## Accepted numeric forms

The numeric portion may be:

- a whole number (`100`, `2`, `10`)
- a decimal (`2.5`, `0.5`, `10.5`, `100.5`) — any number of digits before and
  after the decimal point
- a leading-`.` decimal (`.5`)
- **negative** (a leading `-`): `ms('-200')`, `ms('-1h')`, `ms('-3 days')`

## Invariants

- **Sign symmetry**: for any string `X` that parses to a finite number,
  `ms('-' + X) === -ms(X)`. Negating the input negates the output; the magnitude
  of the parsed value never depends on its sign.
- **Decimal/integer parity**: `ms(d + unit)` parses identically whether the
  decimal's integer part has one digit or many — e.g. `ms('1.5h')` and
  `ms('10.5h')` are both valid and equal `1.5*3600000` and `10.5*3600000`
  respectively.
- A string that does not match the accepted form returns `undefined` / `NaN`
  (invalid), rather than a wrong number.

## Error handling

If `value` is neither a non-empty string nor a finite number, `ms` throws.
