# Shmup Editor doodad sprites

Built-in scenery sprites for `/shmup-editor`. A doodad is just a Unit on the
`"doodad"` layer wearing one of these sprites (see
`src/experiences/ShmupEditor/unitTypes.ts`'s `DOODAD_SPECS`), so they register
in the same `BUILTIN_SPRITES` list as
`src/experiences/ShmupEditor/enemySprites.ts` rather than a separate registry,
and are mirrored into the game bundle's `games/shmup/src/sprites/editorArt.ts`
like every other built-in sprite. Same transparent-background convention as
`../enemies/README.md`.

All 93 files were extracted by `scripts/prepare-doodads.mjs` from the eight
contact sheets Noah supplied directly, listed below. The sheets arrive as
loose top-down props on a flat magenta chroma-key backdrop with no cell
borders, so the per-prop boxes are derived from the art rather than
hand-measured — see `scripts/doodadSegment.mjs` for how, and run
`node scripts/analyze-doodad-sheets.mjs` to see the detected boxes drawn over
each sheet. Keying is a soft key with an un-mix rather than a flat threshold,
so mesh props (camo netting, the fenced rooftop) keep their see-through holes
and nothing carries a pink rim.

Each sprite is centered on a transparent square canvas of at most 256x256,
matching the enemy set. Every one is wired into the default Unit library as a
ready-to-use inert doodad Unit (`unitTypes.ts`'s `createDefaultUnitLibrary`)
with a hand-tuned `size` — see that file; the stats are placeholder data and
not balanced.

## Source sheets

| Sheet | Props | SHA-256 |
|---|---|---|
| `scripts/assets/doodads-source/trees.png` | Foliage — trees and bushes (12) | `ece4f73fa24d73200e4afcec97311e353e01f5d0d874096dd6f2beedb03b396c` |
| `scripts/assets/doodads-source/rocks.png` | Rocks and rubble (12) | `10d438f6fe8e86c405a042ab40695307bd2c5c1af6704f0d10d5b9c426b132dd` |
| `scripts/assets/doodads-source/desert.png` | Desert flora and ground cover (12) | `966a10fa6fbdbdc658f1ec9ca2b09b2b9c842de9738ed62481d4bb02a6eef1d9` |
| `scripts/assets/doodads-source/camp-green.png` | Military camp — tents, earthworks, supplies (12) | `7123abac7512fe073d0ba456333039c39978fdeb4fda4900e534929b28e059a2` |
| `scripts/assets/doodads-source/camp-desert.png` | Desert camp — the same kit in sand colors (12) | `bb3107a15e8cc792cd0538621d9078bfbf036efb7844989b72811b0c984a36f5` |
| `scripts/assets/doodads-source/urban-props.png` | Urban street furniture (12) | `42a34b942af17ddd3cd53f1e47cd470723a7dec31dc3381e107c81afcc6cf4c1` |
| `scripts/assets/doodads-source/industrial-props.png` | Industrial yard clutter (12) | `bbd15235b1de266a6e037fe8abd1240c636335d29342c3686438e98171e71d51` |
| `scripts/assets/doodads-source/rooftops.png` | Rooftop structures (9) | `97af27bb94587780d594aa2859e0d6eba2124a359577c2a3b779cb1df2d0912b` |

## `foliage/` — Foliage — trees and bushes (12)

| File | SHA-256 |
|---|---|
| `broadleaf.png` | `7d0d61e34cf0fa22ddd370f916a01bfc1e75d2b1c033a04b07fe58fcdb76ec7c` |
| `bush-large.png` | `317e3a36933112c09ad4ba37cb08003e7cca6958ea7f0a23de98f3a1b64ad0cc` |
| `bush-round.png` | `963e9923c51adfd83ecae10b50e2f6f1fd5dc42f84e2224e54da7c4f2d87388f` |
| `canopy-wide.png` | `c42db0775732dde3a5d182cfa48b6d74649940fde35e8c7442cb1124c5a159ea` |
| `clover.png` | `c7f4f71b9bdaa7247ab48e538f58c53558a2fa64dca16fc6f6c6baba5e9da8a1` |
| `cluster.png` | `287f7c353e6a9dead1d29660a442b8822991b559d1d410ebac96b11024025641` |
| `dense.png` | `1e0a298915f8ab85bddd238b596f220728c2f32ca72d75d590dfe6ded332d9c6` |
| `fan-palm-large.png` | `6c37e59c44ddff19f96c76f8fd80508782c7de567ca3cde1c819e6f08d31f817` |
| `fan-palm.png` | `902ccd22f611bff6a723656c46a6f9cd9368a2493c03d1d5c597eba68800fc4f` |
| `leafy.png` | `17a370184cfca889d59d3096dfe4cf208fe757fc1c243e136a2d59558e896894` |
| `lobed.png` | `a9769def9c0c02e4fc6c5d744e70860795aa63e6e96bd281c9146129cf3fc9d1` |
| `round.png` | `aed73ba6d2c1dab8779997f9660d4d06172f59943400fa2666b6ade2786b9fd4` |

## `rocks/` — Rocks and rubble (12)

| File | SHA-256 |
|---|---|
| `boulder-pile.png` | `f05af0de22fb3366ba20c03f0003388d8065bf568401eec44504459b275d1beb` |
| `boulders.png` | `bc8b58c3e8a626ee8e2772d71167b220df18931fa7d253495deceaca08e59886` |
| `cluster.png` | `e4c31d5ce2466e044bb2a18b7fcc3e2d87db4ae4bf932953eec8677c9311d375` |
| `field.png` | `294d1c98e89aee7ecfe9bf047ace2bd96561f9e4bce854afcd0f9b55ec754310` |
| `jagged.png` | `e1aa66ce3ffba84d0173f337eae1dd094c798b539ba01a3561618a14201a894e` |
| `pebbles.png` | `2b3dd925a50294626d082ca036cc7b773b6650872233e3cc08d599dff7903ee1` |
| `pile.png` | `89174fc3de8f6ae4373ec1fdfd6e9dac41ce9f2fb60b0da7e8ebb1d5cc871ac4` |
| `ridge.png` | `2b6515a40f16c75ebf46ef8bf976ed17fd0d5b8f8d93f437904dbc4d14b9586d` |
| `rubble-strip.png` | `f105e59f830781aac6062f8f2d213380ac20cc80b4bfefafea63b5cb683de016` |
| `slab.png` | `fb6fcb0c7464b8a4a93b819edef88e44648f6fec7744c302f7b5f2bcb7481f43` |
| `small.png` | `a962069dbc005bcac1f8c979c879ede94d62175e006e5be8c9a0f664ac3ff6a5` |
| `twin.png` | `876d8d4cd59260fc8125f1d8cb8e4a4c91f8e6e57fac7fc2b92c37f35d3c246c` |

## `desert/` — Desert flora and ground cover (12)

| File | SHA-256 |
|---|---|
| `agave.png` | `89a30dedd3f18fa3c25839ac594188bbd794a1fd17e21d9cf26763aeb86eafeb` |
| `bones.png` | `6e40166dee65bcabe456e7958695470536e1220735a0f50989fdfe28df18a502` |
| `boulder.png` | `3e585a1c06480e7782e756fc366c086ebb038849602828b07c231d0ad61475ab` |
| `bush.png` | `95e0dc06b3039e7796ce154d9af4c42c9d0aeb895fa3c700995c194ec392d314` |
| `cactus.png` | `724ff875003367097d9884ba2940b7d5c7f60121bdb7df98cbd41b1148ca57e5` |
| `cracked-ground.png` | `857371d06ec616f1be3eac8dcc2796f2ec73937bfc84dd7b86988098743c3e92` |
| `grass-tuft.png` | `c1632bf5f1c3c1964e34a4208030773629585f7ea63085fd9ffa155c77a0e59b` |
| `pebbles.png` | `67f724b3519206652327201e9265351acb5b228dc15a05c9a3e89cce4cbe1f8f` |
| `sand-patch.png` | `5f8e8a649f6dfc859589f9706c722a0dad0a31e2dd0632e59e4077aec4e77abd` |
| `sandstone.png` | `fc4a6f04d41ae3986164e63f658910fff63947ced6b081707fac8c8a9259ac50` |
| `shrub-small.png` | `56e50acabedcddffbe4137ba3667d41d8409d2f5189f381dbf01d2f582989bc2` |
| `tumbleweed.png` | `82ef3a1c23097209ed47b9f0ed6db4dd34d337a8ee3b7b77d9579b3db519f7a4` |

## `camp/` — Military camp — tents, earthworks, supplies (12)

| File | SHA-256 |
|---|---|
| `barrels.png` | `fede386d4e1491dcf72ad399e4b65fa215d112fbca572180201b2c98e6343073` |
| `barriers.png` | `ad099f15890a452f8353ae43585d3ceb0c78c3566a2d70779a5208fc6e4686ea` |
| `crates.png` | `15cef6cd039ebd37af194e1f1d80763860f5643e03c66e4eb066dd0113417b55` |
| `foxhole-double.png` | `cb3e3aaebad432538c131aaaecc1c2bc3c387d248807ef4d1a427409cc88a6cb` |
| `foxhole.png` | `8a9b8b1c538e38009b989a3a99b0d30e9b6eaeb74161ddca75f1ea6cc8d19293` |
| `netting.png` | `fc287bc4297f3e9c80f06660de866e79e06ae00896f6266a525df9fb0715f224` |
| `sandbag-emplacement.png` | `3e56107fbac4537057ff9829877bd7190bd16cdae76609a6e4ff53224ba146bc` |
| `sandbag-ring.png` | `83d4c08d8a04c036c0e2511906d58abd8df43d84de40b0e349ca4c83dc410e5c` |
| `sandbag-wall.png` | `5028b55c92833667c0572db628eedcc079bea60879695b86e60898cf6b87b74c` |
| `tent-large.png` | `8953836d063e33339a74e1c3c55a7f7b81f0cfad376a02c824370cf0f7072e05` |
| `tent-small.png` | `306d779c2518d7bb6908817ea90d6c097a84c6736a569002fc39e48922ccb6a4` |
| `trench.png` | `3c27e11cd2ea7069b62acf9078675388f83d54762351d4aa96498489dffbe7d6` |

## `camp-desert/` — Desert camp — the same kit in sand colors (12)

| File | SHA-256 |
|---|---|
| `barrels.png` | `a05149670e93dc8ecb84ebab72d5558697fbbe6d1b512b0fa115e5ec03720f39` |
| `crates.png` | `60568267b2c8664d93c0b29266e54be1c76d8195f31d8cd2092a152c780435e7` |
| `foxhole-double.png` | `7643fb4daba2d48ec69eb012325a13056cc58b776c1e80079134624bc3f907da` |
| `foxhole.png` | `8e03baf65af91b6ff42984f6a1618dbca0b3b6288b6ba88e8fcacc45cf258c84` |
| `netting.png` | `d729d5a1383a8c08823576b05ae5cf13743d3231a4b703a81e71aada6cfd52cb` |
| `sandbag-line.png` | `0ab8d5efb58c21e35a8cbe45bd319600953e032f11ccab72de46fa6c12614e71` |
| `sandbag-ring.png` | `39526c2e67fcea1dd77955ae2c1ec2eb98dd3934e9e2f972fad280f10b82bfc5` |
| `sandbag-wall.png` | `0d7476591bfb4605dae77791957746de328957ae99bcd9bbe631496bae6ac034` |
| `tarp.png` | `0127589639972e14e0282a18edc4a660e916d00f0cf0d5a9a0f97b79faed829b` |
| `tent-large.png` | `961bc1cec7f4a3963ffa4604f5196643d043ef196d18c38a6d0b1344dd897a42` |
| `tent-small.png` | `3a28556c0aa445b8b808010ed4c012baeb05fedf82e95aa5ad6e59824c580b50` |
| `trench.png` | `325b2a0de611215a66a2331f0623d1651b702037620f359679aaf3013d3bf207` |

## `urban/` — Urban street furniture (12)

| File | SHA-256 |
|---|---|
| `access-hatch.png` | `c545a7c5250ab20849b294d6759f93a1a392fd253fc7f309d3ed77a5860a2b38` |
| `barricade.png` | `5345fd963d37d52c56bb2d431b86449d55791f3b25f8ef64721f642d9b97198f` |
| `bollards.png` | `09092e7a12c17a18b9ce9fb0c7db76a56396e97b3ecc7ec7edc6e74319fe70e9` |
| `concrete-barriers.png` | `2c65aeb611b95ab06d3e0f41807c5719dbf9de7dc3037abad36286e24c311506` |
| `crater.png` | `7e22d23e2e7f938b265ef647f411b98f2db1e494b0150553242988e0de80469f` |
| `guardrail.png` | `9bf237310d41f08f89301f8d564bb4d55fccc845957b482e83f5abbbf542a4b0` |
| `manhole.png` | `278599c316178976d5ff1a012637a9050ab35846a80b4f94d07bbd97c52afd1e` |
| `pipe-run.png` | `2196efb0e90e0e8ae3fed6a5b62449446277795f64179a781d9875e9b698c5d0` |
| `storm-drain.png` | `d164670f659bb14d4214ae0818bbb7fabe7b140686d70cdd1064993738ac7e94` |
| `street-lamp.png` | `5a8765f6c0d2a7d47d11ad398d6df79c48bf1cc27b5013e6b31c5e80d4b06001` |
| `utility-plate.png` | `df2e3186cc246ce4715aa7e07f6dadebe4b4eba42dfda529fc209eb023911103` |
| `warning-lights.png` | `412ce27541495e6f1ab04d864dc8ef2aa5f2b8829e9cdc7fb2cb30c6dbe23dd9` |

## `industrial/` — Industrial yard clutter (12)

| File | SHA-256 |
|---|---|
| `cable-spool.png` | `776d973331974f0b4b43b134a8f5e1e2b2c3375e94430343d03cc53d128b3700` |
| `container-small.png` | `b59cbe1cf69309aff0e67505ff78d02bc66735b639fbfd04f34f96fe4c653e21` |
| `crates.png` | `e541522f45bd2226bf6de0e1bbcb6aab6cd116677b84357d80c390d395e93d36` |
| `exhaust-fan.png` | `9ca480dd8c53ef10427831b3e4530dcb789f765601593f708589569c26392e05` |
| `generator.png` | `c0f548c5e33c71d87d25a3e565eb9e89d9efa84cc56bb8a6c1b8fd56df41b5b6` |
| `hatch.png` | `cdd7164efedc87a2aade03587d1669b29916a8554e7ffa6f7cbec6a2b19c0361` |
| `hose-coil.png` | `79cb96e306720d37f341823ef9f2bf364f9f62c87511ed27e04816d6a6a85066` |
| `oil-barrels.png` | `4b33751ebb2d1cb01e845f1e79b01e9b878567f7187ea9926e01de1a46b4f829` |
| `oil-spill.png` | `517d6c2aae4dd37d4a626eb849cb8ab590f400e1b4e569597ea5d5393b690db1` |
| `pallet.png` | `c9eba6f4ef596e9d281fa30d85b9d94e7cbe0433776466bf82eb5e961f3904d4` |
| `rubble.png` | `5a1719ff164ae0349be2c4b71a6787593d688302b910af6f028e2184d2f92269` |
| `tires.png` | `13a6bb0445e5a70212603d6e3c71279e690242a58e2e1d5f9200f0e9b20686b2` |

## `rooftops/` — Rooftop structures (9)

| File | SHA-256 |
|---|---|
| `container-large.png` | `c3995d7aec417d32dcc810ed503a047ef6fee842438d4e5efbc8e3be48c17954` |
| `container-row.png` | `2a8f0bd4a82d066ad88367641646fe1f4ca88f7991fb0b1be648bd416144e71b` |
| `factory.png` | `d0e260ddd62c40e0ae32d6c65ee8752cb560f3db714284c7b0a1547cb8c5058f` |
| `fenced-platform.png` | `5f8404bd1910f0b0328e9a674f2d63f1e784ea0dae5f1ffdd61ada895bf25fcd` |
| `helipad.png` | `a0147d0065b0348f7201220e2a9eb96f0803a033fdbc296f58f24328d8a20c70` |
| `plant.png` | `7a05319969691251cf47727033d6fa60ad3d8e6e6de0e945334a89707796d1a2` |
| `tank-cluster.png` | `f71adee475f055f3c566a8714cefdc0adb9f8a52556a9a9649b9ac45bb968d9e` |
| `tank.png` | `db7a4bde42dd84d0a38b557489175407193ae71a357df9899be9a4fda39fe220` |
| `warehouse.png` | `c6545b754cbff3e84b98953e360b27b93b1da65cee4704e33434c2e3534ad3e7` |
