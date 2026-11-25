# LiveArena

LiveArena is a timed arithmetic duel for Solana Blitz v10. Use each of five tiles at most once to reach a shared target. An exact solver submits after 20 seconds and both entries are revealed when the 45-second round ends. Fewer operations win. Time breaks ties.

## Play

```sh
npm ci
npm start
npm test
```

Open [localhost:4173](http://localhost:4173). **Replay devnet round** runs the challenge generated from the application's verified MagicBlock VRF output. **Start practice** generates a new challenge locally. The site can also be served directly from `app/` by a static host.

The devnet round has target **110** and tiles **6, 5, 2, 9, 9**. One optimal expression is `(9+9)*6+2`. Type it early, watch the solver enter, and download the receipt after the clock expires.

## Devnet evidence

The LiveArena request invoked the sponsor's [deployed Roll Dice client](https://github.com/magicblock-labs/magicblock-engine-examples/tree/main/roll-dice/anchor/programs/roll-dice). The MagicBlock VRF program verified the oracle proof and invoked that client's callback at slot 526066004.

- [LiveArena request transaction](https://explorer.solana.com/tx/5wS5F4kksDc2zZRv2qcbAXYSPxcwALZwpcRa7E8s6a9NuDtB5Twmv4tWE49jwkRsakH9cbXerpLpeNgR6kn5WWN8?cluster=devnet)
- [MagicBlock fulfillment transaction](https://explorer.solana.com/tx/36riWEDdCnL6MJcopoE915q2YAASStXoS3ZKKWnH4f39A6sg2k5Gc9YxDuS7uJzyKZM8HSNUP3TMpZWj2ZSVHFjn?cluster=devnet)
- [Checked-in proof used by the app](app/devnet.json)

```sh
npm run proof:verify
npm run round:verify -- /path/to/downloaded-round.json
```

The proof verifier reads both transactions independently, checks the pinned devnet genesis, MagicBlock CPI, derived player address, original request, and callback. A fresh player address is used for each request. The challenge seed is SHA-256 over a versioned prefix, the request signature bytes, and all 32 bytes of callback randomness. The verifier derives the same tiles, target and solver score from that seed.

A developer running `node scripts/new-proof.mjs` can trigger another devnet proof using a disposable signer funded by the MagicBlock devnet faucet. The command sends a devnet request and prints public evidence. Save the verified output as `app/devnet.json` to rotate the hosted round. Players can play and inspect an existing round without connecting a wallet.

## Scope

This MVP runs the clock and scoring in the player's browser. A receipt makes challenge generation, expression validity, move count, and the ranking calculation reproducible. Human time is client-reported. The replay uses a single recorded devnet request, and browser practice uses local entropy. The browser has no wagering, payment, or prize mechanism.

The CLI adapter uses `@solana/web3.js` 1.x, which currently has moderate transitive findings from `npm audit`. The hosted app is browser-native and ships without this adapter or its dependencies.

## Event

- [Solana Blitz v10 registration and schedule](https://luma.com/hedv5sgh)
- [MagicBlock v10 submission form](https://build.magicblock.app/?stage=blitz#submit)
- [Judge pitch and submission checklist](SUBMISSION.md)
