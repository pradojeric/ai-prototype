// ============================================================
// RESTORED ZONE 2 — LIKET (festival), dry and alight again.
// ============================================================
// A faithful, restored recreation of zone2's layout (src/core/zones/zone2.js),
// dressed as Dagupan's Bangus Festival ("Gilon-gilon ed Dalan"): the parade
// avenue is framed by bamboo festival arches (arko) and strung with lanterns and
// bunting, a GIANT MILKFISH FLOAT rides its centre, the Gong Circle keeps the
// beat to the west, the Ruined Dancing Hall and Float Graveyard sit east, and the
// Bandstand Plaza with its glowing parul (star-lantern) mast is the N terminus.
export function buildRestoredZone2(kit, group) {
  kit.setGroup(group);
  kit.ground(92, 12);
  kit.dock(34);

  const cloth = [kit.red, kit.festYellow, kit.festGreen, kit.festBlue];

  // --- Parade stalls lining the avenue ---
  for (let i = 0; i < 7; i++) {
    const cz = 22 - (i / 6) * 44;
    kit.stall(-6.5, cz, Math.PI / 2, cloth[i % cloth.length]);
    kit.stall(6.5, cz, -Math.PI / 2, cloth[(i + 2) % cloth.length]);
  }

  // --- Bamboo festival arches (arko) framing the avenue sightline ---
  for (const z of [20, 8, -6, -20]) bambooArch(kit, z, cloth);

  // --- The giant milkfish float: the festival's centrepiece ---
  bangusFloat(kit, 0, 10);

  // --- Gong Circle (W): drummers' court + a few houses for texture ---
  kit.gongCircle(-28, -14, 6.5);
  for (const [bx, bz] of [[-40, -8], [-38, -28], [-20, -30], [-18, 4]]) kit.house(bx, bz, kit.wallAlt);

  // --- Ruined Dancing Hall (E): shell with a tiled dance floor + chandeliers ---
  kit.hall(26, -28, kit.wallAlt, 7);
  kit.dais(26, -28, 6, kit.stone);
  kit.lanternCluster(24, -29, { count: 6, y: 5.5, radius: 1.1, color: 0xbfe9e2 });
  kit.lanternCluster(29, -26, { count: 4, y: 4.8, radius: 0.8, color: 0xbfe9e2 });

  // --- Float Graveyard (far E): restored parade floats + shed, festooned ---
  kit.box(7, 4.5, 6, kit.wallAlt, 40, 2.25, 12, -Math.PI / 2.4);
  const floats = [[34, -2, 0.3], [38, 4, -0.6], [33, 10, 1.4], [40, 16, 0.1]];
  floats.forEach(([x, z, r], i) => {
    kit.boat(x, z, r, cloth[i % cloth.length]);
    kit.bunting(x - 1.2, z, x + 1.2, z, 1.9, 2, cloth, 0.25);
  });

  // --- Bandstand Plaza: the avenue's northern terminus + the parul mast ---
  const cz = -40;
  kit.dais(0, cz, 4.4);
  kit.parulMast(-3, cz - 2, { height: 14, starR: 1.7 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    kit.box(1.6, 0.5, 0.5, kit.wood, Math.cos(a) * 7, 0.35, cz + Math.sin(a) * 7, a + Math.PI / 2);   // benches
  }

  // --- Parade Avenue: overhead lantern + bunting canopy down the spine ---
  [18, 6, -6, -18].forEach((z, i) => {
    if (i % 2 === 0) kit.lanternString(-8.5, z, 8.5, z, 3.6, 6, i === 0 ? 0xffb35c : 0xff8f6b, 0.5);
    else kit.bunting(-8.5, z, 8.5, z, 3.7, 7, cloth, 0.7);
  });

  // --- Gateways, festooned for the festival ---
  kit.arch(0, 26, 0, { span: 6, height: 5 });
  kit.lanternString(-3, 26, 3, 26, 4.6, 4, 0xffb35c, 0.35);

  // --- Lantern Overlook (SE) ---
  kit.box(8, 1.6, 8, kit.stone, 33, 0.8, 30);
  kit.lanternCluster(35.6, 32.6, { count: 5, y: 7.5, radius: 0.7, withPost: true, postHeight: 8, color: 0xffce7a });

  // --- Drifting light + Hibla threads ---
  kit.motes(0, -6, 24);
  kit.hibla([
    { pts: [[-8, 2, 30], [-3, 8, 8], [3, 7, -16], [-1, 5, -40]], color: 0xffd49a, phase: 0.2 },
    { pts: [[8, 2, 26], [3, 9, 4], [-4, 7, -20], [1, 5, -40]], color: 0x76f4e7, phase: 0.6 },
  ]);

  // One slow pan: rise up the festival avenue, through the arches and past the
  // giant bangus float, to the glowing parul star.
  return [
    { t: 0, pos: [0, 6, 42], look: [0, 5, -16] },
    { t: 6.5, pos: [0, 5.5, 2], look: [-2, 8, -40] },
  ];
}

// A bamboo festival arch (arko) spanning the parade avenue, hung with a banner.
function bambooArch(kit, z, cloth) {
  const half = 8;
  for (const sx of [-1, 1]) kit.cyl(0.16, 0.2, 6.5, 6, kit.bamboo, sx * half, 3.25, z);
  const top = kit.cyl(0.16, 0.16, half * 2, 6, kit.bamboo, 0, 6.4, z);
  top.rotation.z = Math.PI / 2;
  // curved bamboo crest + a hanging banner
  const crest = kit.cyl(half, half, 0.14, 8, kit.bamboo, 0, 6.4, z, 0);
  crest.rotation.x = Math.PI / 2;
  crest.scale.set(1, 1, 0.001);                 // flatten to a thin ring segment
  kit.box(5, 1.1, 0.1, cloth[Math.abs(z) % cloth.length], 0, 5.6, z);   // banner
}

// The giant milkfish (bangus) float: a silver fish sculpture on a wheeled,
// festooned parade platform — the Bangus Festival's signature icon.
function bangusFloat(kit, x, z) {
  // wheeled platform
  kit.box(5, 0.6, 9, kit.wood, x, 1.1, z);
  for (const sx of [-1, 1]) for (const oz of [-3.2, 0, 3.2]) {
    const w = kit.cyl(0.6, 0.6, 0.4, 12, kit.shutter, x + sx * 2.2, 0.6, z + oz);
    w.rotation.z = Math.PI / 2;
  }
  kit.bunting(x - 2.4, z + 4.4, x + 2.4, z + 4.4, 2.0, 3, [kit.red, kit.festYellow, kit.festGreen], 0.2);

  // the milkfish body (elongated, silver), lying along +Z
  const body = kit.sphere(2.0, kit.bangus, x, 4.2, z, 16, 12);
  body.scale.set(0.8, 1.0, 2.4);
  const head = kit.sphere(1.3, kit.bangus, x, 4.2, z - 4.2, 14, 10);
  head.scale.set(0.8, 0.95, 1.2);
  kit.sphere(0.28, kit.shutter, x + 0.7, 4.7, z - 4.7, 8, 6);        // eye
  kit.sphere(0.28, kit.shutter, x - 0.7, 4.7, z - 4.7, 8, 6);
  // forked tail fin at the back (+Z)
  const tailTop = kit.cone(1.4, 2.6, 4, kit.bangus, x, 5.4, z + 5.4);
  tailTop.rotation.x = -Math.PI / 2.4;
  tailTop.scale.set(0.25, 1, 1);
  const tailBot = kit.cone(1.4, 2.6, 4, kit.bangus, x, 3.0, z + 5.4);
  tailBot.rotation.x = Math.PI / 2.4;
  tailBot.scale.set(0.25, 1, 1);
  // dorsal + side fins
  const dorsal = kit.cone(0.9, 1.6, 4, kit.bangus, x, 6.0, z);
  dorsal.scale.set(0.2, 1, 1);
  for (const sx of [-1, 1]) {
    const fin = kit.cone(0.8, 1.4, 4, kit.bangus, x + sx * 1.5, 3.6, z + 0.5);
    fin.rotation.z = sx * Math.PI / 2.2;
    fin.scale.set(0.2, 1, 1);
  }
}
