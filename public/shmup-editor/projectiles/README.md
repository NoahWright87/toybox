# Shmup Editor projectile sprites

Built-in placeholder projectile sprites for `/shmup-editor`'s Unit/Weapon
system — a projectile is just a Unit spawned by a `WeaponDef.spawnUnitId`
(see `src/experiences/ShmupEditor/unitTypes.ts`'s file header), so these
register in the same `BUILTIN_SPRITES` list as
`src/experiences/ShmupEditor/enemySprites.ts`, not a separate registry.
Same transparent-background convention as `../enemies/README.md`.

All 20 files below were extracted from one 73-icon contact sheet Noah
supplied directly (ChatGPT-generated), `scripts/assets/projectiles-source/projectiles-sheet.png`
(SHA-256 `9448ab8bbf1ae796531c77afeb5b3abff1957ef6b027c4f6f86432b68a21c8b6`),
via `scripts/prepare-projectiles.mjs` — a curated subset spanning the
sheet's visual range (small-arms bullets, rockets, bombs/mines, fire/
energy orbs, sci-fi canisters) rather than all 73 icons, so the Unit
picker gets a useful, visually distinct set instead of a wall of near-
duplicates. Each is wired into the default Unit library as its own
ready-to-use projectile Unit (`unitTypes.ts`'s `createDefaultUnitLibrary`)
with made-up but varied `hp`/`speed`/`size`/`contactDamage` stats — see
that file, this is placeholder data and not balanced.

| File | SHA-256 |
|---|---|
| `bullet-tiny.png` | `bed421562d17322d1afb8de51123473078521a76883dec62be2c938096185d18` |
| `bullet-red-tip.png` | `422638b40d2a2d7e0709d5df6324239f7d2b7778bde62feed10b70ec969db0d9` |
| `bullet-tracer.png` | `ccba8282d2e2f1bf53c7a0a1a3f25b766b60c71678fe109a4cae41086c9cc598` |
| `bullet-copper.png` | `8de8a2c26c7a3d31b04b044278f96a6814b5a2e10a2b1cacef6679da10b60c6f` |
| `shell-heavy.png` | `e045ed15190053584593efea8dbe9ea04e4673f6e2b3430d11e514763437dcfc` |
| `rocket-red.png` | `9be0111845121f969d69861ce7bdda5145caa46ec23283ee3b82264db4ee1cbe` |
| `rocket-gold.png` | `2bd6b267ab382b1943d40a1b856d9b0f88b0904e16e4517d3b6f677585a70565` |
| `missile-static.png` | `d8eae69052d9dc80f1e9afb30dd0669b6840692100e086e429343824e1fd2148` |
| `poison-flask.png` | `a52039ca891b57626f6fe1c7eabb963083c85742eb2deed522961e719e685c48` |
| `mine-spiked-ball.png` | `69a752b856e474430a483b057529fa412e9dcb29fc15048c64f24908e1a4f196` |
| `cluster-shell.png` | `9c84609d0e877484ad14a7c61584cf8aa345c4a775728fb963e71ed2a2984ef9` |
| `mine-morning-star.png` | `54b4e68777af90e073baf8ddfd2e36d96e0a0899b137859f0e5f5db7aa23f9a0` |
| `fire-orb.png` | `4cab4cd0c52c75b9847805a4392a5db837677a4ad0bc994d34f5b0417892cb98` |
| `starburst.png` | `7ae673ad1d0b252e70aead61c536601e6e36592bca1ed16dca707d85a6dcd835` |
| `energy-orb-blue.png` | `6d64663279750b874d58791426c2319fd8a3658606766bac67883fe5a4cb79f4` |
| `lightning-bolt.png` | `5a8ce97c00a6b45d2638e0f8d9c53860dd43f2557ff9aabe8c9c46d58a823e5e` |
| `crystal-burst-green.png` | `3b8e2b561ba2ee3fc293ac33f7996e93fd95d7b271121936c38635dd822f9621` |
| `orb-capsule-purple.png` | `5f309c0c8e0d61268e21859c99810efd1890c30e5680db75d35d70a4cabe6875` |
| `toxic-canister.png` | `5fcf6f76767d6b4432e14adcf18610936c38149b3053d6b66e645234d04f9895` |
| `energy-canister-blue.png` | `fc747325e9589d9712025af9e33fdebf1f008fa8cb680ba45dd813a6e90d269c` |

The sheet also included a standalone `projectile-basic.png` — byte-
identical to `../enemies/bullet-basic.png`'s own source
(`scripts/assets/bullet-basic-source.png`) — so it was dropped rather than
processed into a duplicate sprite; `bullet-basic` already covers it and is
what the default "Bullet" Unit uses.

Per root `CLAUDE.md`'s dependency policy, document the source and SHA-256 of
every file added here (`sha256sum <file>`), same as `../tiles/README.md`.
