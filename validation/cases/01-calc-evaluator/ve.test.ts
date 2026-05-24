// Independent Verification Environment for the arithmetic expression evaluator.
// Authored ONLY from spec.md + the exported name in sut.ts.
// The VE has NOT read impl.buggy.ts / impl.correct.ts / meta.json.
//
// Run the whole study from the repo root:  node validation/score.mjs

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { evaluate } from './sut';

// ---------------------------------------------------------------------------
// REFERENCE MODEL (golden) — written independently from the spec.
// Grammar (no parentheses, flat):
//   expr   := term ( (+|-) term )*
//   term   := factor ( (*|/) factor )*
//   factor := non-negative-integer
// Operators may be surrounded by optional single spaces.
// Division is real (float) division. Malformed input throws Error.
//
// This is a from-scratch recursive-descent evaluator. It does NOT mirror any
// implementation; it is derived purely from the spec's stated grammar and
// precedence/associativity rules, validated against the spec's worked examples.
// ---------------------------------------------------------------------------

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'op'; value: '+' | '-' | '*' | '/' };

function tokenize(expr: string): Token[] {
  // Validate the character set first: only digits, the four operators, and
  // spaces are permitted. Anything else is malformed -> throw.
  // (Spec: "non-digit characters other than the four operators and spaces MUST throw".)
  const tokens: Token[] = [];
  let i = 0;
  const n = expr.length;
  while (i < n) {
    const ch = expr[i];
    if (ch === ' ') {
      i++;
      continue;
    }
    if (ch >= '0' && ch <= '9') {
      let j = i;
      while (j < n && expr[j] >= '0' && expr[j] <= '9') j++;
      tokens.push({ kind: 'num', value: Number(expr.slice(i, j)) });
      i = j;
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ kind: 'op', value: ch });
      i++;
      continue;
    }
    throw new Error(`Malformed input: unexpected character '${ch}'`);
  }
  return tokens;
}

function referenceEvaluate(expr: string): number {
  const tokens = tokenize(expr);
  if (tokens.length === 0) throw new Error('Malformed input: empty expression');

  // Structural validation: must alternate num, op, num, op, ... starting and
  // ending with num. Catches: leading op, trailing op, two ops in a row,
  // two nums in a row.
  for (let k = 0; k < tokens.length; k++) {
    const expectedNum = k % 2 === 0;
    if (expectedNum && tokens[k].kind !== 'num') {
      throw new Error('Malformed input: expected operand');
    }
    if (!expectedNum && tokens[k].kind !== 'op') {
      throw new Error('Malformed input: expected operator');
    }
  }
  if (tokens.length % 2 === 0) {
    // ends on an operator
    throw new Error('Malformed input: trailing operator');
  }

  // Two-pass evaluation: first collapse * and /, then + and -.
  // Build the value/operator streams.
  const nums: number[] = [];
  const ops: ('+' | '-' | '*' | '/')[] = [];
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    if (t.kind === 'num') nums.push(t.value);
    else ops.push(t.value);
  }

  // First pass: resolve * and / left-to-right.
  const reducedNums: number[] = [nums[0]];
  const reducedOps: ('+' | '-')[] = [];
  for (let k = 0; k < ops.length; k++) {
    const op = ops[k];
    const rhs = nums[k + 1];
    if (op === '*') {
      reducedNums[reducedNums.length - 1] = reducedNums[reducedNums.length - 1] * rhs;
    } else if (op === '/') {
      reducedNums[reducedNums.length - 1] = reducedNums[reducedNums.length - 1] / rhs;
    } else {
      reducedOps.push(op);
      reducedNums.push(rhs);
    }
  }

  // Second pass: resolve + and - left-to-right.
  let acc = reducedNums[0];
  for (let k = 0; k < reducedOps.length; k++) {
    if (reducedOps[k] === '+') acc += reducedNums[k + 1];
    else acc -= reducedNums[k + 1];
  }
  return acc;
}

// ---------------------------------------------------------------------------
// Self-test of the reference model against the spec's worked examples.
// If these fail, the BENCH is wrong, not the SUT. (Bench-has-teeth guard.)
// ---------------------------------------------------------------------------
describe('reference-model self-check (spec worked examples)', () => {
  const cases: Array<[string, number]> = [
    ['2+3*4', 14],
    ['2*3+4', 10],
    ['10-2-3', 5],
    ['8/4/2', 1],
    ['100', 100],
    ['7/2', 3.5],
    ['1+2*3-4*5', -13],
    ['42', 42]
  ];
  for (const [input, expected] of cases) {
    test(`model("${input}") === ${expected}`, () => {
      expect(referenceEvaluate(input)).toBe(expected);
    });
  }
});

// ---------------------------------------------------------------------------
// DIRECTED: spec worked examples driven against the SUT with hand-derived values.
// ---------------------------------------------------------------------------
describe('directed — spec worked examples (hand-derived)', () => {
  const cases: Array<[string, number]> = [
    ['2+3*4', 14], // 3*4=12, +2 => 14
    ['2*3+4', 10], // 2*3=6, +4 => 10
    ['10-2-3', 5], // (10-2)-3 => 5 (left-assoc)
    ['8/4/2', 1], // (8/4)/2 => 2/2 = 1 (left-assoc)
    ['100', 100],
    ['7/2', 3.5], // real division
    ['1+2*3-4*5', -13], // 1 + 6 - 20 => -13
    ['42', 42], // single operand
    ['2+3', 5],
    ['2 + 3', 5], // whitespace variant must equal "2+3"
    ['2 * 3', 6]
  ];
  for (const [input, expected] of cases) {
    test(`evaluate("${input}") === ${expected}`, () => {
      expect(evaluate(input)).toBe(expected);
    });
  }
});

// ---------------------------------------------------------------------------
// SCOREBOARD: SUT vs reference model over constrained-random valid expressions.
// Generator emits only LEGAL expressions per the spec grammar.
// ---------------------------------------------------------------------------

// Operand: non-negative integer. Keep magnitude modest to avoid float noise
// dominating; include 0 to exercise division-by-zero / multiply-by-zero.
const operandArb = fc.integer({ min: 0, max: 999 });
const opArb = fc.constantFrom('+', '-', '*', '/');

// Build a canonical (no-space) legal expression and its token structure.
const exprArb = fc
  .tuple(
    operandArb,
    fc.array(fc.tuple(opArb, operandArb), { minLength: 0, maxLength: 6 })
  )
  .map(([first, rest]) => {
    let s = String(first);
    for (const [op, operand] of rest) {
      s += op + String(operand);
    }
    return s;
  });

// Helper: float-tolerant equality (both NaN counts as equal so that a shared
// division-by-zero -> NaN does not register as a false discrepancy).
function numEqual(a: number, b: number): boolean {
  if (Number.isNaN(a) && Number.isNaN(b)) return true;
  if (a === b) return true;
  // tolerate tiny float drift in either direction
  if (Number.isFinite(a) && Number.isFinite(b)) {
    return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  }
  return false;
}

describe('scoreboard — SUT vs independent reference model (random legal exprs)', () => {
  test('SUT result matches reference model on all legal expressions', () => {
    fc.assert(
      fc.property(exprArb, (expr) => {
        const model = referenceEvaluate(expr);
        const dut = evaluate(expr);
        if (!numEqual(model, dut)) {
          throw new Error(
            `DISCREPANCY on "${expr}": model=${model} dut=${dut}`
          );
        }
      }),
      { numRuns: 2000 }
    );
  });
});

// ---------------------------------------------------------------------------
// METAMORPHIC relations (oracle-free) — these need no reference model.
// ---------------------------------------------------------------------------
describe('metamorphic — whitespace invariance', () => {
  test('adding single spaces around operators does not change the result', () => {
    fc.assert(
      fc.property(exprArb, (expr) => {
        // Insert a single space around each operator.
        const spaced = expr.replace(/([+\-*/])/g, ' $1 ');
        const compact = evaluate(expr);
        const withSpaces = evaluate(spaced);
        if (!numEqual(compact, withSpaces)) {
          throw new Error(
            `whitespace not invariant: "${expr}"=${compact} vs "${spaced}"=${withSpaces}`
          );
        }
      }),
      { numRuns: 1000 }
    );
  });
});

describe('metamorphic — precedence invariant (spec invariant)', () => {
  test('evaluate("a+b*c") === a + b*c', () => {
    fc.assert(
      fc.property(operandArb, operandArb, operandArb, (a, b, c) => {
        const expr = `${a}+${b}*${c}`;
        const expected = a + b * c;
        const dut = evaluate(expr);
        if (!numEqual(expected, dut)) {
          throw new Error(`precedence a+b*c failed: "${expr}" expected ${expected} got ${dut}`);
        }
      }),
      { numRuns: 1000 }
    );
  });

  test('evaluate("a*b+c") === a*b + c', () => {
    fc.assert(
      fc.property(operandArb, operandArb, operandArb, (a, b, c) => {
        const expr = `${a}*${b}+${c}`;
        const expected = a * b + c;
        const dut = evaluate(expr);
        if (!numEqual(expected, dut)) {
          throw new Error(`precedence a*b+c failed: "${expr}" expected ${expected} got ${dut}`);
        }
      }),
      { numRuns: 1000 }
    );
  });

  test('mixed: evaluate("a-b*c") === a - b*c', () => {
    fc.assert(
      fc.property(operandArb, operandArb, operandArb, (a, b, c) => {
        const expr = `${a}-${b}*${c}`;
        const expected = a - b * c;
        const dut = evaluate(expr);
        if (!numEqual(expected, dut)) {
          throw new Error(`precedence a-b*c failed: "${expr}" expected ${expected} got ${dut}`);
        }
      }),
      { numRuns: 1000 }
    );
  });
});

describe('metamorphic — left-associativity (spec invariant)', () => {
  test('evaluate("a-b-c") === (a-b)-c, NOT a-(b-c)', () => {
    fc.assert(
      fc.property(operandArb, operandArb, operandArb, (a, b, c) => {
        const expr = `${a}-${b}-${c}`;
        const left = a - b - c; // (a-b)-c
        const dut = evaluate(expr);
        if (!numEqual(left, dut)) {
          throw new Error(`left-assoc subtraction failed: "${expr}" expected ${left} got ${dut}`);
        }
      }),
      { numRuns: 1000 }
    );
  });

  test('evaluate("a/b/c") === (a/b)/c for nonzero b,c', () => {
    fc.assert(
      fc.property(
        operandArb,
        fc.integer({ min: 1, max: 999 }),
        fc.integer({ min: 1, max: 999 }),
        (a, b, c) => {
          const expr = `${a}/${b}/${c}`;
          const left = a / b / c;
          const dut = evaluate(expr);
          if (!numEqual(left, dut)) {
            throw new Error(`left-assoc division failed: "${expr}" expected ${left} got ${dut}`);
          }
        }
      ),
      { numRuns: 1000 }
    );
  });
});

// ---------------------------------------------------------------------------
// DIRECTED boundary / structural cases with hand-derived expected values.
// ---------------------------------------------------------------------------
describe('directed — boundary & associativity corners (hand-derived)', () => {
  const cases: Array<[string, number]> = [
    ['0', 0],
    ['0+0', 0],
    ['1+1+1+1', 4],
    ['2*2*2', 8], // left-assoc multiply
    ['16/2/2/2', 2], // ((16/2)/2)/2 = 2
    ['10-1-1-1', 7], // ((10-1)-1)-1
    ['1+2*3', 7], // 1 + 6
    ['2*3+4*5', 26], // 6 + 20
    ['100-50/2', 75], // 100 - 25
    ['3*4-2', 10], // 12 - 2
    ['7-3+2', 6], // (7-3)+2 left-assoc, not 7-(3+2)=2
    ['9/2', 4.5],
    ['5*0', 0],
    ['0*5', 0],
    ['1000000+1', 1000001]
  ];
  for (const [input, expected] of cases) {
    test(`evaluate("${input}") === ${expected}`, () => {
      expect(evaluate(input)).toBe(expected);
    });
  }
});

// ---------------------------------------------------------------------------
// ERROR PATHS — malformed input MUST throw Error (spec: never silently wrong).
// ---------------------------------------------------------------------------
describe('error paths — malformed input MUST throw', () => {
  const malformed: Array<[string, string]> = [
    ['', 'empty string'],
    ['   ', 'only whitespace'],
    ['2+', 'trailing operator'],
    ['+2', 'leading operator'],
    ['2++3', 'two operators in a row'],
    ['2+*3', 'two operators in a row (mixed)'],
    ['2 3', 'two operands in a row'],
    ['2a', 'non-digit char'],
    ['a', 'pure letter'],
    ['2.5', 'decimal point not allowed (integer operands only)'],
    ['(2+3)', 'parentheses not allowed'],
    ['2^3', 'unsupported operator ^'],
    ['*', 'lone operator'],
    ['-', 'lone minus'],
    ['2+3-', 'trailing operator after valid prefix'],
    ['2//3', 'two divides in a row']
  ];
  for (const [input, why] of malformed) {
    test(`evaluate(${JSON.stringify(input)}) throws (${why})`, () => {
      expect(() => evaluate(input)).toThrow();
    });
  }
});

// ---------------------------------------------------------------------------
// ADVERSARIAL / fuzz — random strings from a small alphabet. The SUT must
// EITHER return a number that matches the model on legal inputs, OR throw on
// malformed inputs. It must never return a wrong number silently and never
// return a non-number for a thing it accepts.
// ---------------------------------------------------------------------------
describe('adversarial fuzz — accept-or-throw, never silently wrong', () => {
  const charArb = fc.constantFrom(
    ...'0123456789+-*/ '.split('')
  );
  const fuzzArb = fc.array(charArb, { minLength: 0, maxLength: 12 }).map((cs) => cs.join(''));

  test('SUT either matches model or throws (no silent wrong answers)', () => {
    fc.assert(
      fc.property(fuzzArb, (s) => {
        let modelOk = true;
        let modelVal = 0;
        try {
          modelVal = referenceEvaluate(s);
        } catch {
          modelOk = false;
        }

        let dutOk = true;
        let dutVal = 0;
        try {
          dutVal = evaluate(s);
        } catch {
          dutOk = false;
        }

        // If both consider it legal, the values must match.
        if (modelOk && dutOk) {
          if (!numEqual(modelVal, dutVal)) {
            throw new Error(`silent-wrong on ${JSON.stringify(s)}: model=${modelVal} dut=${dutVal}`);
          }
        }
        // If the model says legal but SUT throws, that is a SUT over-rejection
        // (a potential bug, but the spec's must-throw clause is one-directional:
        // malformed MUST throw; it does not forbid throwing on something the
        // model accepts unless that thing is clearly legal). We surface
        // disagreement on acceptance as an explicit failure so it is visible.
        if (modelOk !== dutOk) {
          throw new Error(
            `acceptance disagreement on ${JSON.stringify(s)}: model ${
              modelOk ? 'accepts=' + modelVal : 'rejects'
            }, dut ${dutOk ? 'accepts=' + dutVal : 'rejects'}`
          );
        }
        // When the SUT returns a value, it must be a real number type.
        if (dutOk && typeof dutVal !== 'number') {
          throw new Error(`SUT returned non-number for ${JSON.stringify(s)}: ${dutVal}`);
        }
      }),
      { numRuns: 4000 }
    );
  });
});
