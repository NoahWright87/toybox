# Incoming enemy sprite batch (raw sources)

Placeholder vehicle/turret art supplied directly by Noah (not downloaded),
originally staged at `public/shmup-editor/enemies/incoming/` pending
processing. `../../prepare-incoming-enemies.mjs` chroma-keys the magenta
(or, for `heli.png`, near-white) background out of each of these, splits
the three body+turret sheets into their separate parts, trims/pads/resizes
the result, and writes the final built-in sprites to
`public/shmup-editor/enemies/` (see that folder's `README.md` for the
processed output list). All sources are 1254x1254 PNG, no alpha.

| File | SHA-256 | Notes |
|---|---|---|
| `battleship-sheet.png` | `0305995d1aed96371dc2e28b14bbbb3ab7ea9540389988822fc2721bc9adb33e` | Ship hull + 8 turret variants on one sheet — only the hull and one turret are extracted |
| `missile-truck-sheet.png` | `9bb08fa311aa8a4694e9d567fc952d93e51e59dfd098b72503cbdcec7284660c` | Truck body + missile-pod turret |
| `train-gun-car-sheet.png` | `fca892b09d6568b9e9a5f131d25119587c318e76821e3591bca816c1d5dce866` | Armored rail car body + 6 turret variants — only the body and one turret are extracted |
| `train-front.png` | `2b27b9de2479652e2550bed90483314a8668d45ebd26e286caff682623afc576` | Locomotive front car (single sprite) |
| `train-rear.png` | `11329cdb8a4968fcfabd86bcfbeada632e4b8f468ccd72ba99bf5f2ccf4ce01b` | Rear/caboose car (single sprite) |
| `heli.png` | `1233bf52f84a911df63773b041d9b4d7c80bb9638801a0779bc671db0db30444` | Attack helicopter (single sprite, near-white keyed background instead of magenta) |
| `heli-transport.png` | `3da05ae6d8289db0bf3200d927547dc1730f6ec45ce1259a2ab1b7d456a01bb2` | Tandem-rotor transport helicopter (single sprite) |
| `jet-bomber.png` | `884a68bdfc30b9e425efae0cd51926a58fb49d77e737b739d914e9e3e1d15767` | Delta-wing jet bomber (single sprite) |
| `jet-fighter.png` | `262a35c8c2800af52aab850042112cd7595ce0daa445ba266c57ed0e4cffbda4` | Swing-wing jet fighter (single sprite) |
| `jet-stealth.png` | `ba678eaca0b38efc95fee3331a7332553d62580a177094611b23b454e993e4ff` | Stealth fighter (single sprite) |
| `motorcycle-sidecar.png` | `609bb74531608b4866196106c199a5d306ed8ad90549a893f20d578d81d856a3` | Motorcycle + gunner sidecar (single fused sprite) |
| `plane-prop.png` | `6903efffd9f13fe8b033c12b4a9984433f9d33c313946e0b295d13661e87497b` | Propeller bomber (single sprite) |
| `truck-transport.png` | `9a56cccef2bcbb9dc1c03093ec639e7839023b52963346e211ec2a654f6e356f` | Canvas-back transport truck (single sprite) |
| `turret.png` | `bbf62721a4d339cd4144d76ba9e35f91ba2a94b1fa6f8c19be49e15a4e8da803` | Single-barrel stationary turret (single sprite) |
| `turret-4x.png` | `ace8e1e5a57788f7097b796a557d69a7f6018f1d75b1a0fc01d2e9a6cfa3ffe3` | Quad-barrel stationary turret (single sprite) |

Per root `CLAUDE.md`'s dependency policy, this documents source and SHA-256
for every binary asset added here.
