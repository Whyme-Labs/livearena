import { awaitProof, faucetWallet, requestProof } from './vrf.mjs';

const { connection, keypair } = await faucetWallet();
const request = await requestProof(connection, keypair);
console.error('Devnet request ' + request);
const proof = await awaitProof(connection, keypair.publicKey, request);
console.log(JSON.stringify(proof, null, 2));
