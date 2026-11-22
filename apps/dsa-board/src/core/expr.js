/**
 * Safe recursive-descent expression evaluator for user-defined hash functions.
 * Supported variables: k, n
 * Supported functions: sum, len, code, num, abs, min, max, poly
 * Supported operators: + - * / % ()
 */
const BUILTINS = {
  sum: (k) => [...('' + k)].reduce((a, c) => a + c.charCodeAt(0), 0),
  len: (k) => ('' + k).length,
  code: (k, i) => ('' + k).charCodeAt(i) || 0,
  num: (k) => +k || 0,
  abs: Math.abs,
  min: Math.min,
  max: Math.max,
  poly: (k, b) => [...('' + k)].reduce((a, c) => (a * b + c.charCodeAt(0)) % 1000003, 0),
};

export function evalExpr(src, vars) {
  const tokens = src.match(/[A-Za-z_]\w*|\d+|[-+*\/%(),]/g) || [];
  let p = 0;

  const parseExpr = () => {
    let v = parseTerm();
    while (tokens[p] === '+' || tokens[p] === '-') {
      const op = tokens[p++];
      const r = parseTerm();
      v = op === '+' ? +v + +r : v - r;
    }
    return v;
  };

  const parseTerm = () => {
    let v = parseUnary();
    while (tokens[p] === '*' || tokens[p] === '/' || tokens[p] === '%') {
      const op = tokens[p++];
      const r = parseUnary();
      v = op === '*' ? v * r : op === '/' ? Math.trunc(v / r) : ((v % r) + r) % r;
    }
    return v;
  };

  const parseUnary = () => (tokens[p] === '-' ? (p++, -parseUnary()) : parsePrimary());

  const parsePrimary = () => {
    const x = tokens[p++];
    if (x === undefined) throw Error('unexpected end');
    if (x === '(') {
      const v = parseExpr();
      if (tokens[p++] !== ')') throw Error('missing )');
      return v;
    }
    if (/^\d/.test(x)) return +x;
    if (tokens[p] === '(') {
      p++;
      const args = [];
      if (tokens[p] === ')') {
        p++;
      } else {
        args.push(parseExpr());
        while (tokens[p] === ',') {
          p++;
          args.push(parseExpr());
        }
        if (tokens[p++] !== ')') throw Error('missing )');
      }
      if (!BUILTINS[x]) throw Error('unknown fn ' + x);
      return BUILTINS[x](...args);
    }
    if (x in vars) return vars[x];
    throw Error('unknown name ' + x);
  };

  const result = parseExpr();
  if (p < tokens.length) throw Error('unexpected ' + tokens[p]);
  return Math.trunc(+result) || 0;
}
