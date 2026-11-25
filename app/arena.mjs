const bytePattern = /^[0-9a-f]{64}$/;
const operations = ['+', '-', '*', '/'];

function choose(seed, domain, count) {
  const source = Uint8Array.from(seed.match(/../g), (byte) => Number.parseInt(byte, 16));
  // Different bytes select the tiles and the target. Big-endian, reduced to the choice set.
  const offset = domain * 2;
  return ((source[offset] << 8) | source[offset + 1]) % count;
}

function apply(operator, left, right) {
  switch (operator) {
    case '+': return left + right;
    case '-': return left - right;
    case '*': return left * right;
    case '/': return right !== 0 && left % right === 0 ? left / right : null;
    default: throw new Error('Unknown operation.');
  }
}

function compareSolutions(first, second) {
  return first.moves - second.moves
    || first.expression.length - second.expression.length
    || (first.expression > second.expression ? 1 : Number(first.expression < second.expression) * -1);
}

function retain(table, value, solution) {
  if (value === null) return;
  const existing = table.get(value);
  if (!existing || compareSolutions(solution, existing) < 0) table.set(value, solution);
}

function search(tiles) {
  const reachable = Array.from({ length: 1 << tiles.length }, () => new Map());
  const best = new Map();

  for (let mask = 1; mask < reachable.length; mask++) {
    if ((mask & (mask - 1)) === 0) {
      const tile = tiles[Math.log2(mask)];
      reachable[mask].set(tile, { expression: String(tile), moves: 0 });
    }

    for (let leftMask = (mask - 1) & mask; leftMask; leftMask = (leftMask - 1) & mask) {
      const rightMask = mask ^ leftMask;
      for (const [left, leftSolution] of reachable[leftMask]) {
        for (const [right, rightSolution] of reachable[rightMask]) {
          for (const operator of operations) {
            const value = apply(operator, left, right);
            if (value === null) continue;
            const render = (solution) => solution.moves ? '(' + solution.expression + ')' : solution.expression;
            retain(reachable[mask], value, {
              expression: render(leftSolution) + operator + render(rightSolution),
              moves: leftSolution.moves + rightSolution.moves + 1,
            });
          }
        }
      }
    }

    for (const [value, solution] of reachable[mask]) retain(best, value, solution);
  }
  return best;
}

export function generate(seed) {
  if (typeof seed !== 'string' || !bytePattern.test(seed)) throw new Error('A 32-byte hexadecimal seed is required.');
  const side = [2, 3, 4, 5, 6, 7, 8, 9];
  const tiles = [0, 1, 2, 3, 4].map((index) => side[choose(seed, index, side.length)]);
  const solutions = search(tiles);
  const eligible = [...solutions].filter(([value, solution]) => value >= 21 && value <= 120 && solution.moves >= 3);
  const targets = eligible.sort(([left], [right]) => left - right);
  if (!targets.length) throw new Error('This seed did not yield a challenge.');
  const [target, solver] = targets[choose(seed, 5, targets.length)];
  return { tiles, target, solver };
}

export function evaluate(expression, tiles, target) {
  if (typeof expression !== 'string' || expression.length > 64) throw new Error('Enter an expression of up to 64 characters.');
  const text = expression.trim();
  if (!text || /[^2-9+*\/()\-\s]/.test(text)) throw new Error('Use the shown tiles, +, −, ×, ÷ and parentheses.');
  const tokens = text.match(/\S/g);
  const remaining = [...tiles];
  let cursor = 0;
  let moves = 0;

  function atom() {
    const token = tokens[cursor++];
    if (token === '(') {
      const value = expressionAt(0);
      if (tokens[cursor++] !== ')') throw new Error('Close the parentheses.');
      return value;
    }
    const tile = /[2-9]/.test(token ?? '') ? Number(token) : null;
    if (tile === null) throw new Error('Expected a tile or an opening parenthesis.');
    const index = remaining.indexOf(tile);
    if (index === -1) throw new Error('Each tile may be used only once.');
    remaining.splice(index, 1);
    return tile;
  }

  function expressionAt(minimum) {
    let result = atom();
    for (;;) {
      const operator = tokens[cursor];
      const precedence = ({ '+': 1, '-': 1, '*': 2, '/': 2 })[operator] ?? 0;
      if (precedence <= minimum) return result;
      cursor++;
      const right = expressionAt(precedence);
      result = apply(operator, result, right);
      if (result === null) throw new Error('Division must yield a whole number and cannot divide by zero.');
      moves++;
    }
  }

  const result = expressionAt(0);
  if (cursor !== tokens.length) throw new Error('Put an operator between tiles.');
  if (result !== target) throw new Error('That evaluates to ' + result + '. Reach ' + target + ' to score.');
  return { expression: tokens.join(''), moves };
}

export function rank(human, solver) {
  if (!human) return 'solver';
  if (human.moves !== solver.moves) return human.moves < solver.moves ? 'human' : 'solver';
  return human.elapsedMs === solver.elapsedMs ? 'tie' : human.elapsedMs < solver.elapsedMs ? 'human' : 'solver';
}
