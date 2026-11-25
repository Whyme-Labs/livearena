import { createHash, randomInt } from 'node:crypto';
import { Connection, Keypair, PublicKey, SystemProgram, SYSVAR_SLOT_HASHES_PUBKEY, Transaction, TransactionInstruction } from '@solana/web3.js';
import bs58 from 'bs58';

export const DEVNET = 'https://api.devnet.solana.com';
export const GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
export const DICE_PROGRAM = new PublicKey('3iSNV84a4hp2AiZpczjeuJEy4PTVCSzZZyU533MR6tEU');
const VRF_PROGRAM = new PublicKey('Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz');
const VRF_IDENTITY = new PublicKey('9irBy75QS2BN81FUgXuHcjqceJJRuc9oDkAe8TKVvvAw');
const QUEUE = new PublicKey('Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh');
const confirmation = 'confirmed';
const signaturePattern = /^[1-9A-HJ-NP-Za-km-z]{80,90}$/;

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const discriminator = (name) => createHash('sha256').update('global:' + name).digest().subarray(0, 8);

function derivePlayer(payer) {
  return PublicKey.findProgramAddressSync([Buffer.from('playerd'), payer.toBuffer()], DICE_PROGRAM)[0];
}

function hasDiscriminator(data, name) {
  return data.subarray(0, 8).equals(discriminator(name));
}

export async function devnetConnection() {
  const connection = new Connection(DEVNET, { commitment: confirmation, disableRetryOnRateLimit: true });
  if (await connection.getGenesisHash() !== GENESIS) throw new Error('Expected Solana devnet.');
  return connection;
}

export async function verifyProof(connection, request, fulfillment) {
  if (!signaturePattern.test(request ?? '') || !signaturePattern.test(fulfillment ?? '')) {
    throw new Error('Enter two Solana transaction signatures.');
  }
  const opts = { commitment: confirmation, maxSupportedTransactionVersion: 0 };
  const [requestTx, callbackTx] = await Promise.all([
    connection.getParsedTransaction(request, opts),
    connection.getParsedTransaction(fulfillment, opts),
  ]);
  if (!requestTx?.meta || !callbackTx?.meta || requestTx.meta.err || callbackTx.meta.err
    || requestTx.slot > callbackTx.slot || request === fulfillment) {
    throw new Error('Both transactions must be successful devnet transactions in order.');
  }
  const matchingRequests = requestTx.transaction.message.instructions.flatMap((instruction, index) => {
    if (!instruction.programId.equals(DICE_PROGRAM) || !instruction.data) return [];
    const bytes = Buffer.from(bs58.decode(instruction.data));
    return bytes.length === 9 && hasDiscriminator(bytes, 'roll_dice') ? [index] : [];
  });
  const [requestIndex] = matchingRequests;
  const requestInstruction = requestTx.transaction.message.instructions[requestIndex];
  const [payer, player, queue] = requestInstruction?.accounts ?? [];
  const payerSigned = requestTx.transaction.message.accountKeys.some((key) => key.signer && key.pubkey.equals(payer ?? PublicKey.default));
  if (matchingRequests.length !== 1 || !payerSigned || !player?.equals(derivePlayer(payer)) || !queue?.equals(QUEUE)
    || !requestTx.meta.innerInstructions?.some((group) => group.index === requestIndex
      && group.instructions.some((instruction) => instruction.programId.equals(VRF_PROGRAM)))) {
    throw new Error('This request did not invoke the Devnet VRF queue for its player.');
  }
  const requestBytes = Buffer.from(bs58.decode(requestInstruction.data));
  const callback = callbackTx.meta.innerInstructions?.flatMap(({ index, instructions }) =>
    callbackTx.transaction.message.instructions[index].programId.equals(VRF_PROGRAM) ? instructions : []).find((instruction) => {
    if (!instruction.programId.equals(DICE_PROGRAM) || !instruction.data) return false;
    const bytes = Buffer.from(bs58.decode(instruction.data));
    return bytes.length === 41 && hasDiscriminator(bytes, 'callback_roll_dice')
      && bytes[40] === requestBytes[8] && instruction.accounts[0]?.equals(VRF_IDENTITY)
      && instruction.accounts[1]?.equals(player);
  });
  if (!callback) throw new Error('This fulfillment did not return valid VRF output to the requested player and seed.');

  // A fresh player PDA has only its request behind this callback. This keeps the
  // callback argument's one-byte seed from becoming an ambiguous match.
  const earlier = await connection.getSignaturesForAddress(player, { before: fulfillment, limit: 2 }, confirmation);
  if (earlier.length !== 1 || earlier[0].signature !== request) {
    throw new Error('The fulfillment must belong to a fresh player with one request.');
  }
  const random = Buffer.from(bs58.decode(callback.data)).subarray(8, 40);
  const seed = createHash('sha256').update('livearena:vrf:v1\0').update(bs58.decode(request)).update(random).digest('hex');
  return {
    chain: 'devnet', request, fulfillment, player: player.toBase58(), payer: payer.toBase58(),
    requestSlot: requestTx.slot, fulfillmentSlot: callbackTx.slot,
    random: random.toString('hex'), seed,
  };
}

export async function awaitProof(connection, payer, request) {
  const player = derivePlayer(payer);
  for (let attempt = 0; attempt < 42; attempt++) {
    const recent = await connection.getSignaturesForAddress(player, { limit: 8 }, confirmation);
    for (const { signature, err } of recent) {
      if (err || signature === request) continue;
      try {
        return await verifyProof(connection, request, signature);
      } catch (error) {
        if (!/Both transactions must be successful|This fulfillment did not return/.test(error.message)) throw error;
      }
    }
    await delay(2500);
  }
  throw new Error('No matching devnet VRF fulfillment appeared before the wait limit.');
}

export async function requestProof(connection, wallet) {
  const payer = wallet.publicKey;
  const player = derivePlayer(payer);
  const [identity] = PublicKey.findProgramAddressSync([Buffer.from('identity')], DICE_PROGRAM);
  const meta = (pubkey, isWritable = false, isSigner = false) => ({ pubkey, isWritable, isSigner });
  if (await connection.getAccountInfo(player, confirmation)) throw new Error('Use a fresh devnet payer for each round.');
  const tx = new Transaction().add(
    new TransactionInstruction({
      programId: DICE_PROGRAM, data: discriminator('initialize'),
      keys: [meta(payer, true, true), meta(player, true), meta(SystemProgram.programId)],
    }),
    new TransactionInstruction({
      programId: DICE_PROGRAM, data: Buffer.concat([discriminator('roll_dice'), Buffer.from([randomInt(256)])]),
      keys: [meta(payer, true, true), meta(player), meta(QUEUE, true), meta(identity), meta(VRF_PROGRAM), meta(SYSVAR_SLOT_HASHES_PUBKEY), meta(SystemProgram.programId)],
    }),
  );
  const block = await connection.getLatestBlockhash(confirmation);
  tx.recentBlockhash = block.blockhash;
  tx.feePayer = payer;
  tx.sign(wallet);
  const request = await connection.sendRawTransaction(tx.serialize(), { preflightCommitment: confirmation });
  const status = await connection.confirmTransaction({ signature: request, ...block }, confirmation);
  if (status.value.err) throw new Error('The devnet request was rejected.');
  return request;
}

export async function faucetWallet() {
  const connection = await devnetConnection();
  const keypair = Keypair.generate();
  console.error('Disposable devnet payer ' + keypair.publicKey.toBase58());
  const faucet = new Connection('https://rpc.magicblock.app/devnet', { disableRetryOnRateLimit: true });
  if (await faucet.getGenesisHash() !== GENESIS) throw new Error('The faucet RPC is not Solana devnet.');
  const signature = await faucet.requestAirdrop(keypair.publicKey, 20_000_000);
  console.error('Airdrop ' + signature);
  for (let attempt = 0; attempt < 20; attempt++) {
    if (await connection.getBalance(keypair.publicKey, confirmation) >= 2_000_000) return { connection, keypair };
    await delay(1000);
  }
  throw new Error('The devnet airdrop was not confirmed.');
}
