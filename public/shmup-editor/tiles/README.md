# Shmup Editor tile art

Placeholder full-tile art, supplied directly by Noah (not downloaded) for
use as built-in tile background images in `/shmup-editor`. Each image is
one whole 1x1 tile's art (scaled to fit its square, not repeated as a
small pattern) — a footprint > 1 tile shows one copy per column. 1254x1254
PNG, no alpha.

| File | SHA-256 | Notes |
|---|---|---|
| `water.png` | `300a3ed17cfc8bb97559a3d1ceea86ad2403804fe5eaba7d8f419b5fd468859c` | plain water |
| `grass.png` | `a2e6c5a558a03e8d4c41264c3d6f1b932110116101a6c7c7ad48caaad9c5cc62` | plain grass |
| `shore.png` | `66908a5baf9719eaf903b2ad8b5fc8ce5f72386cc9b48bcd9cad51b3bc94ea5f` | water-to-grass transition, for testing mixed-edge tiles (e.g. water on north, grass on south) |

Referenced by `src/experiences/ShmupEditor/tileImages.ts`.
