function tokenize(expr: string): Array<number | string> {
  const matches = expr.match(/\s*([0-9]+|[+\-*/])\s*/g);
  if (!matches) throw new Error(`empty expression: ${JSON.stringify(expr)}`);
  const stripped = matches.map((m) => m.trim());
  if (stripped.join('') !== expr.replace(/\s+/g, '')) {
    throw new Error(`invalid characters in expression: ${JSON.stringify(expr)}`);
  }
  const out: Array<number | string> = [];
  for (const tok of stripped) {
    out.push(/^[0-9]+$/.test(tok) ? Number(tok) : tok);
  }
  if (out.length % 2 === 0) throw new Error(`malformed expression: ${JSON.stringify(expr)}`);
  for (let i = 0; i < out.length; i++) {
    const expectNumber = i % 2 === 0;
    if (expectNumber !== (typeof out[i] === 'number')) {
      throw new Error(`malformed expression: ${JSON.stringify(expr)}`);
    }
  }
  return out;
}

function apply(a: number, op: string, b: number): number {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      return a / b;
    default:
      throw new Error(`unknown operator ${op}`);
  }
}

export function evaluate(expr: string): number {
  const tokens = tokenize(expr);
  // First pass: resolve * and / (higher precedence).
  const reduced: Array<number | string> = [tokens[0]];
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i] as string;
    const rhs = tokens[i + 1] as number;
    if (op === '*' || op === '/') {
      const lhs = reduced.pop() as number;
      reduced.push(apply(lhs, op, rhs));
    } else {
      reduced.push(op, rhs);
    }
  }
  // Second pass: resolve + and - left to right.
  let acc = reduced[0] as number;
  for (let i = 1; i < reduced.length; i += 2) {
    acc = apply(acc, reduced[i] as string, reduced[i + 1] as number);
  }
  return acc;
}
