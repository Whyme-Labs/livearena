import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { evaluate, generate, rank } from '../app/arena.mjs';
import { devnetConnection, verifyProof } from './vrf.mjs';

if (!process.argv[2]) throw new Error('Pass the downloaded round receipt JSON path.');
const receipt = JSON.parse(await readFile(process.argv[2], 'utf8'));
if (receipt.version !== 1) throw new Error('Unsupported receipt version.');
if (receipt.chainProof) {
  const proof = await verifyProof(await devnetConnection(), receipt.chainProof.request, receipt.chainProof.fulfillment);
  if (!isDeepStrictEqual(proof, receipt.chainProof) || proof.seed !== receipt.seed) throw new Error('VRF proof differs from the receipt.');
}
const challenge = generate(receipt.seed);
if (!isDeepStrictEqual(challenge.tiles, receipt.tiles) || challenge.target !== receipt.target) throw new Error('Challenge differs from the seed.');
const solver = { ...challenge.solver, elapsedMs: 20_000 };
if (!isDeepStrictEqual(solver, receipt.solver)) throw new Error('Solver score differs from its reproducible entry.');
const human = receipt.human;
if (human) {
  const entry = evaluate(human.expression, receipt.tiles, receipt.target);
  if (!Number.isInteger(human.elapsedMs) || human.elapsedMs < 0 || human.elapsedMs >= 45_000
    || !isDeepStrictEqual({ ...entry, elapsedMs: human.elapsedMs }, human)) throw new Error('Invalid human entry.');
}
const winner = rank(human, solver);
if (winner !== receipt.winner) throw new Error('The winning score differs from the receipt.');
console.log(JSON.stringify({ source: receipt.chainProof ? 'devnet' : 'practice', winner, clock: 'client-reported' }));
