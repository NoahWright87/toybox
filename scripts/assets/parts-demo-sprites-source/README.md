# Parts-demo sprite sheets (source)

Two "body + turret" reference sheets, ChatGPT-generated and supplied
directly by Noah (not downloaded), for testing the Shmup Editor's
multi-Part Unit system (specs/shmup-editor.todo.md's Parts/weapon-track
pass — a `UnitPart` needs its own sprite to be a useful standalone test
case, e.g. a battleship/tank turret rendered and positioned separately
from its hull).

Each sheet is a 1254x1254 PNG on a **solid magenta background**, containing
**two separate objects side by side**: a vehicle body (left, larger) and
its turret (right, smaller). `scripts/prepare-parts-demo-sprites.mjs`
chroma-keys the magenta out and splits each sheet into two separate
built-in sprites — see that script's header comment for why a global
color test was needed instead of a simple border flood fill (the turret's
ring shape encloses an interior "lake" of background color unreachable
from the canvas edge).

| File | SHA-256 | Vehicle |
|---|---|---|
| `armored-truck-sheet.png` | `ca6d920abd78c77c3005ef7494f97108ff9d320c5602150d06f15d4c50ea285f` | Armored personnel-carrier-style truck + roof-mounted MG turret |
| `battle-tank-sheet.png` | `378f714b81008104a192d1001cf983ee4204e8f4d7edc82c3682cf1aabe30872` | Tank hull + rotating cannon turret |

Split into `public/shmup-editor/enemies/armored-truck-{body,turret}.png`
and `public/shmup-editor/enemies/battle-tank-{body,turret}.png` — see that
folder's README.md.
