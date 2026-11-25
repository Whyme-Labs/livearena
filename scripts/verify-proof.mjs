import { readFile } from 'node:fs/promises';
import { generate } from '../app/arena.mjs';
import { devnetConnection, verifyProof } from './vrf.mjs';

const [first, second] = process.argv.slice(2);
const evidence = second ? { request: first, fulfillment: second } : JSON.parse(await readFile(first ?? 'app/devnet.json', 'utf8'));
const proof = await verifyProof(await devnetConnection(), evidence.request, evidence.fulfillment);
if (evidence.seed && evidence.seed !== proof.seed) throw new Error('Receipt seed differs from the on-chain proof.');
console.log(JSON.stringify({ proof, challenge: generate(proof.seed) }, null, 2));
