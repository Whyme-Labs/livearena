# LiveArena for Solana Blitz v10

LiveArena turns mental arithmetic into a race against an exact solver. Players and the solver receive the same five tiles and target. Fewer operations win, then time breaks ties. The demo challenge comes from an on-chain verified MagicBlock VRF callback. The round receipt lets a judge reproduce the challenge and scoring rule.

## Demo

1. Click **Replay devnet round**. The verified seed yields target 110 and tiles 6, 5, 2, 9, 9.
2. Try `9+9+9` to see the tile inventory check. Then lock in `(9+9)*6+2` before the solver's 20-second mark.
3. At the end of the round, see the solver's optimal expression and the ranking. Download the receipt.
4. Compare the receipt with the [verified request and fulfillment in the README](README.md#devnet-evidence).

## Submission fields

| Field | Value or requirement |
|---|---|
| Project name | LiveArena |
| Edition | Solana Blitz v10 · Entertainment Finance |
| Project website | Static deployment of `app/` |
| GitHub project repo | [Whyme-Labs/livearena](https://github.com/Whyme-Labs/livearena), accessible to judges |
| Pitch & demo | Hosted presentation or video following the demo above |
| Explorer link | [Devnet fulfillment](https://explorer.solana.com/tx/36riWEDdCnL6MJcopoE915q2YAASStXoS3ZKKWnH4f39A6sg2k5Gc9YxDuS7uJzyKZM8HSNUP3TMpZWj2ZSVHFjn?cluster=devnet) |
| Optional integration address | Disposable devnet payer `8XhpNLFUbJgcjkVzpjTyYxCVgxag2ckWreDB2HabpD1P` |
| Close | Nov 27, 2026 at 14:00 UTC / 10:00 PM Malaysia time, according to the [organizer's schedule](https://luma.com/hedv5sgh) |

The [V10 stage](https://build.magicblock.app/?stage=blitz#submit) lists Ephemeral Rollup or VRF as the required integration. LiveArena uses VRF for independent challenge entropy. The match is free to play. A potential competitive product could add server-attested match clocks and audited tournament standings before offering prize-backed matches.
