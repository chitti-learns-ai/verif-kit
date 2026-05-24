# Spec — Arithmetic expression evaluator

A pure function that evaluates a flat arithmetic expression string.

## Interface

```ts
export function evaluate(expr: string): number;
```

## Behavior

- The expression contains non-negative integer operands and the binary
  operators `+`, `-`, `*`, `/`. Operators may be surrounded by optional single
  spaces (`"2+3"` and `"2 + 3"` are both valid and equal).
- **Standard operator precedence applies**: `*` and `/` bind more tightly than
  `+` and `-`. Within the same precedence level, evaluation is left-associative.
- There are no parentheses.
- Division is real (floating-point) division.

## Worked examples (these define the required semantics)

- `evaluate("2+3*4")` → `14` (the `3*4` happens before the `+`)
- `evaluate("2*3+4")` → `10`
- `evaluate("10-2-3")` → `5` (left-associative)
- `evaluate("8/4/2")` → `1`
- `evaluate("100")` → `100`
- `evaluate("7/2")` → `3.5`
- `evaluate("1+2*3-4*5")` → `-13` (i.e. `1 + 6 - 20`)

## Edge cases / errors

- A single operand is valid and returns itself: `evaluate("42")` → `42`.
- Malformed input (empty string, trailing operator, two operators in a row,
  non-digit characters other than the four operators and spaces) MUST throw an
  `Error` — never return a wrong number silently.

## Invariants

- **Precedence invariant**: for operands a,b,c, `evaluate("a+b*c") === a + b*c`
  and `evaluate("a*b+c") === a*b + c`.
- **Associativity**: a chain of same-precedence operators evaluates left to right.
- **Whitespace invariance**: inserting/removing the optional single spaces around
  operators does not change the result.
