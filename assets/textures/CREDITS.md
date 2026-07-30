# Museum, Zone & Restored-Zone Textures — Credits

All surface textures under `assets/textures/` are **CC0 1.0 (public domain)** from
[ambientCG](https://ambientcg.com) by Lennart Demes. CC0 requires no attribution;
this note is a courtesy record.

Each folder holds a JPG set (`color.jpg`, `normal.jpg` = OpenGL-style normal,
`roughness.jpg`). Museum + ending sets are 1K; the submerged-zone sets added for
zones 1–3 are downsampled to **512** — the zones are heavily fogged, so fine texel
detail is never visible there, and the smaller sets keep the low-end/mobile texture
budget affordable.

## Ending diorama — `src/cutscene/_partials/RestoredKit.js`

| Folder    | ambientCG asset      | Used for |
|-----------|----------------------|----------|
| brick     | Bricks075A           | St. John Cathedral / market brick |
| plaster   | PaintedPlaster001    | walls, Capitol / Manaoag stone, lighthouse white, limestone |
| paving    | PavingStones037      | market street, plazas, daises, columns |
| grass     | Grass004             | ground |
| roof      | RoofingTiles004      | terracotta roofs |
| wood      | Planks011            | posts, stalls, docks, market hall |
| rock      | Rock030              | Hundred Islands limestone islets |

## Submerged zones 1–3 — `src/core/_partials/TextureKit.js` + `src/core/World.js`

512-px sets (see note above). The zone engine also re-uses `plaster`, `paving`,
`wood` and `rock` from the ending-diorama table.

| Folder | ambientCG asset | Used for                                      |
|--------|-----------------|-----------------------------------------------|
| silt   | Ground051       | seabed floor (dark river mud)                 |
| rust   | MetalPlates013  | warehouse shells, anchors, rusted metal props |
| moss   | Moss002         | mangrove canopy, algae growth                 |

## Guardian bosses — `src/core/guardians/_partials/GuardianTextureKit.js`

512-px sets. ambientCG has no coral material, so `Sponge001` stands in for the Zone 2
Reveler's reef body (normals/roughness only — its orange albedo would muddy the coral
teal). The guardians also re-use `rock`, `moss` and `marble` from the tables above.

| Folder | ambientCG asset | Used for                                          |
|--------|-----------------|---------------------------------------------------|
| bamboo | Bamboo001A      | Z1 Feastkeeper limbs, chest lattice, spears       |
| wicker | Wicker004       | Z1 rope wraps, rattan hands, fish-trap hip fringe |
| clay   | Clay001         | Z1 shoulder pots, Z3 Keeper torso pottery         |
| fabric | Fabric030       | Z2 Reveler mantle fins                            |
| sponge | Sponge001       | Z2 coral lattice body and coral clusters          |

## Museum "Aking Museo" hub — `src/museum/Museum.js`

| Folder        | ambientCG asset | Used for |
|---------------|-----------------|----------|
| marble        | Marble018       | gallery floor (polished marble) |
| gallery-wall  | Plaster003      | gallery + wing walls |
| marble-tiles  | Tiles101        | gallery ceiling (tiled accent) |
| marble-pale   | Marble012       | artifact plinths + zone-marker bases (pale veined marble, chosen to read against the darker `marble` floor) |
| brass         | Metal007        | plinth cap rings + zone-marker medallions — 512 px, it only ever covers small trim |

## Environment map — `assets/hdri/`

| File               | Source                                     | Used for |
|--------------------|--------------------------------------------|----------|
| `gallery_1k.hdr`   | Poly Haven "studio_small_09" (1K), CC0     | museum hub `scene.environment` (IBL reflections) |

Poly Haven assets are **CC0 1.0**. Source: <https://polyhaven.com/a/studio_small_09>

Source: <https://ambientcg.com> · License: <https://docs.ambientcg.com/books/licenses/>
