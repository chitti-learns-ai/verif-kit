# Spec — `stripJsonComments(jsonString, [options])`

Derived from the public README/API docs of the `strip-json-comments` library.

```ts
export default function stripJsonComments(
  jsonString: string,
  options?: { whitespace?: boolean }
): string;
```

## Behavior

Strip JavaScript-style comments from a string of JSON so that the result is
parseable by `JSON.parse`, while letting authors keep comments in their JSON
source files.

- Single-line comments begin with `//` and run to the end of the line.
- Multi-line comments are delimited by `/*` and `*/`.
- By default (`whitespace: true`), each stripped comment is **replaced with
  whitespace** of the same length (newlines preserved) so that character offsets
  and line/column positions of the remaining JSON stay aligned with the original.
- With `whitespace: false`, comments are removed entirely (no padding).

Documented example:

```js
const json = `{
  // Rainbows
  "unicorn": /* ❤ */ "cake"
}`;
JSON.parse(stripJsonComments(json)); //=> { unicorn: 'cake' }
```

## CRITICAL: comments inside string values are NOT comments

`//` and `/*` that appear **inside a JSON string literal** are ordinary string
content and MUST be preserved untouched. Comment stripping only applies to text
that is OUTSIDE of any string.

To know whether the parser is inside or outside a string, the function tracks
JSON double-quoted strings. As in JSON, a double-quote that is **escaped** (i.e.
preceded by a backslash) does NOT close the string; the string continues. A
backslash itself can be escaped (`\\`), so whether a given `"` is escaped depends
on the **parity of the unbroken run of backslashes immediately before it**: an
odd-length run escapes the quote (string continues), an even-length run (including
zero) does not (the quote opens/closes the string).

Examples of string content that must survive verbatim:

- `{"u":"http://example.com"}` — the `//` is inside the string; nothing stripped.
- `{"u":"/* not a comment */"}` — the `/* */` is inside the string; preserved.
- A string value that itself contains an escaped quote followed by `//` keeps
  that `//` because it is still inside the (not-yet-closed) string.

## Inputs / errors

- `jsonString` MUST be a string.
- The function operates purely lexically; it does not validate that the input is
  well-formed JSON. Any string in (whether inside a string literal, a comment, or
  structural JSON) is handled consistently.

## Invariants

- **Strings are inviolate**: the byte content of every JSON string literal in the
  input appears unchanged in the output. No `//` or `/* */` inside a string is
  ever treated as a comment, regardless of how the string's quotes are escaped
  (any number of preceding backslashes).
- **Idempotent on comment-free input**: if the input contains no comments outside
  of strings, the output equals the input.
- **Length preservation (default mode)**: with `whitespace: true`, the output has
  the same length as the input (comments become equal-length whitespace).
- **Round-trip**: for valid JSON-with-comments, `JSON.parse(stripJsonComments(s))`
  yields the same value as parsing the comment-free equivalent.
