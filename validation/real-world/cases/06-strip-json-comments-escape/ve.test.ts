// Independent VE testbench — derived ONLY from spec.md.
// Contract: stripJsonComments removes // and /* */ comments that are OUTSIDE
// string literals, replacing them with equal-length whitespace by default
// (whitespace:true). Strings are inviolate; whether a `"` closes the string
// depends on the PARITY of the unbroken backslash run immediately before it.
import { describe, test, expect } from 'vitest';
import stripJsonComments from './sut';

describe('strip-json-comments — documented example round-trips', () => {
  test('JSON.parse(strip(json)) === { unicorn: "cake" }', () => {
    const json = `{
  // Rainbows
  "unicorn": /* ❤ */ "cake"
}`;
    expect(JSON.parse(stripJsonComments(json))).toEqual({ unicorn: 'cake' });
  });
});

describe('strip-json-comments — strings are inviolate (CRITICAL invariant)', () => {
  // // and /* */ inside a string literal are ordinary content; preserved verbatim.
  test('// inside a string is preserved', () => {
    const s = '{"u":"http://example.com"}';
    expect(stripJsonComments(s)).toBe(s); // no comments outside strings
    expect(JSON.parse(stripJsonComments(s))).toEqual({ u: 'http://example.com' });
  });
  test('/* */ inside a string is preserved', () => {
    const s = '{"u":"/* not a comment */"}';
    expect(stripJsonComments(s)).toBe(s);
    expect(JSON.parse(stripJsonComments(s))).toEqual({ u: '/* not a comment */' });
  });
});

describe('strip-json-comments — escaped-quote backslash parity (the named edge)', () => {
  // An ESCAPED quote (odd backslash run before it) does NOT close the string, so
  // any // or /* following it is still inside the string and must survive.
  test('string with escaped quote then // stays intact', () => {
    // JSON source: {"x":"a\"//b"}   (the \" is an escaped quote; // is in-string)
    const s = '{"x":"a\\"//b"}';
    const out = stripJsonComments(s);
    // The // is inside the (not-yet-closed) string -> nothing stripped.
    expect(out).toBe(s);
    // And it parses to the literal value containing the //.
    expect(JSON.parse(out)).toEqual({ x: 'a"//b' });
  });

  test('string with escaped quote then /* */ stays intact', () => {
    // JSON source: {"x":"a\"/* still string */ b"}
    const s = '{"x":"a\\"/* still string */ b"}';
    const out = stripJsonComments(s);
    expect(out).toBe(s);
    expect(JSON.parse(out)).toEqual({ x: 'a"/* still string */ b' });
  });

  test('ODD run of THREE backslashes still escapes the quote (string continues)', () => {
    // JSON source: {"x":"a\\\"//b"}  — three backslashes before the inner quote.
    // Run length 3 is ODD => the " is escaped => the string CONTINUES, so the
    // //b that follows is inside the string and must be preserved verbatim.
    // (A naive "is the single preceding char a backslash?" check handles run=1
    //  but gets run=3 wrong; the spec mandates parity of the WHOLE run.)
    const s = '{"x":"a\\\\\\"//b"}';
    const out = stripJsonComments(s);
    expect(out).toBe(s); // nothing stripped: the // is in-string
    expect(JSON.parse(out)).toEqual({ x: 'a\\"//b' });
  });

  test('ODD run of FIVE backslashes still escapes the quote', () => {
    // five backslashes before the inner quote => odd => quote escaped => continue
    const s = '{"x":"a\\\\\\\\\\"//b"}';
    const out = stripJsonComments(s);
    expect(out).toBe(s);
    expect(JSON.parse(out)).toEqual({ x: 'a\\\\"//b' });
  });

  test('EVEN backslash run before quote DOES close the string', () => {
    // JSON source: {"x":"a\\"}//c   -> the \\ is an escaped backslash (even run),
    // so the following " CLOSES the string. The //c after it is a real comment.
    const s = '{"x":"a\\\\"}//c';
    const out = stripJsonComments(s);
    // value parses to 'a\' and the trailing //c is stripped -> valid JSON.
    expect(JSON.parse(out)).toEqual({ x: 'a\\' });
    // default whitespace mode preserves length
    expect(out.length).toBe(s.length);
  });
});

describe('strip-json-comments — idempotent on comment-free input (spec invariant)', () => {
  const samples = [
    '{"a":1,"b":[1,2,3],"c":"x"}',
    '{"u":"http://x/y"}',
    '   {"k":"v"}   ',
    '{"nested":{"q":"a\\"b"}}',
  ];
  for (const s of samples) {
    test(`output === input for: ${s.trim()}`, () => {
      expect(stripJsonComments(s)).toBe(s);
    });
  }
});

describe('strip-json-comments — length preservation in default mode (spec invariant)', () => {
  const samples = [
    `{\n  // c\n  "a": 1\n}`,
    `{ "a": /* x */ 1 }`,
    `{"u":"http://x"} // tail`,
  ];
  for (const s of samples) {
    test(`length preserved (whitespace:true default) for sample`, () => {
      expect(stripJsonComments(s).length).toBe(s.length);
    });
  }
});

describe('strip-json-comments — whitespace:false removes comments entirely', () => {
  test('comment removed, JSON still parses', () => {
    const s = `{ "a": 1 /* note */ }`;
    const out = stripJsonComments(s, { whitespace: false });
    expect(JSON.parse(out)).toEqual({ a: 1 });
  });
});
