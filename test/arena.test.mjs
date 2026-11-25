import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluate, generate, rank } from '../app/arena.mjs';

test('published fixture generates a reproducible challenge', () => {
  assert.deepEqual(generate('00'.repeat(32)), {
    tiles: [2, 2, 2, 2, 2], target: 24, solver: { expression: '(((2*2)+2)*2)*2', moves: 4 },
  });
});

test('derived targets are solvable across varied seeds', () => {
  for (let index = 0; index < 96; index++) {
    const seed = createHash('sha256').update(String(index)).digest('hex');
    const { solver, tiles, target } = generate(seed);
    assert.ok(solver.moves >= 3);
    assert.deepEqual(evaluate(solver.expression, tiles, target), solver);
  }
});

test('validate precedence, tile inventory, adjacent literals and division', () => {
  assert.deepEqual(evaluate('6 + 4*(3-2)', [6, 4, 3, 2, 6], 10), { expression: '6+4*(3-2)', moves: 3 });
  assert.throws(() => evaluate('6+6+6', [6, 6, 2, 3, 4], 18), /only once/);
  assert.throws(() => evaluate('62', [6, 2, 3, 4, 5], 62), /operator/);
  assert.throws(() => evaluate('3/2*4', [3, 2, 4, 5, 6], 6), /whole number/);
  assert.throws(() => evaluate('6/(4-4)', [6, 4, 4, 2, 2], 0), /cannot divide by zero/);
  assert.throws(() => evaluate('6+(4-2', [6, 4, 2, 3, 5], 8), /parentheses/);
  assert.throws(() => evaluate('globalThis', [6, 4, 2, 3, 5], 8), /shown tiles/);
});

test('move count outranks time and time breaks exact ties in move count', () => {
  const solver = { moves: 3, elapsedMs: 20_000 };
  assert.equal(rank({ moves: 4, elapsedMs: 1 }, solver), 'solver');
  assert.equal(rank({ moves: 3, elapsedMs: 11_000 }, solver), 'human');
  assert.equal(rank({ moves: 3, elapsedMs: 20_000 }, solver), 'tie');
  assert.equal(rank(null, solver), 'solver');
});
