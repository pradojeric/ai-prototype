// ============================================================
// RESTORED ZONE 1 — PONSIA (food & market), dry and alive again.
// ============================================================
// A faithful, restored recreation of zone1's layout (src/core/zones/zone1.js),
// dressed as the real Dagupan market on the Pantal: a central market avenue of
// intact stalls leading to the Silent Auction Square and its bell-mast tower
// (N terminus); the long roofed Public Market Hall anchoring the west; and the
// Pantal riverside to the east, lined with bamboo milkfish pens (kasilayan) and
// the boatyard's bangkâs — Dagupan being the country's bangus (milkfish) capital.
export function buildRestoredZone1(kit, group) {
  kit.setGroup(group);
  kit.ground(92, 12);
  kit.dock(34);

  // --- Drowning Stalls: two intact rows lining the avenue (x = ±6.5) ---
  const awnings = [kit.teal, kit.red, kit.festYellow];
  for (let i = 0; i < 7; i++) {
    const cz = 22 - (i / 6) * 44;
    kit.stall(-6.5, cz, Math.PI / 2, awnings[i % awnings.length]);
    kit.stall(6.5, cz, -Math.PI / 2, awnings[(i + 1) % awnings.length]);
  }
  kit.lanternString(-8, 14, 8, 14, 3.6, 6, 0xffce7a, 0.6);
  kit.lanternString(-8, 0, 8, 0, 3.6, 6, 0xffce7a, 0.6);
  kit.lanternString(-8, -14, 8, -14, 3.6, 6, 0xffce7a, 0.6);

  // --- Public Market Hall (W): the district's civic anchor ---
  marketHall(kit, -28, -6);
  // a couple of surviving Memories Alley houses behind it for depth
  for (const [bx, bz] of [[-42, -26], [-42, -6], [-40, 14]]) kit.house(bx, bz, (bx + bz) % 2 ? kit.wall : kit.white);

  // --- Pantal riverside (E): milkfish pens + the Lost Boatyard ---
  pantalRiverside(kit, 44);
  kit.box(7, 4.5, 6, kit.wallAlt, 37, 2.25, 12, -Math.PI / 2.4);   // boatyard shed
  [[33, 18, 0.3], [36, 24, -0.5]].forEach(([x, z, r], i) => kit.boat(x, z, r, i % 2 ? kit.teal : kit.red));

  // --- Silent Auction Square: the avenue's northern terminus ---
  const sq = -38;
  kit.dais(0, sq, 3.6);
  kit.tower(-4.5, sq - 1, { height: 19, baseR: 1.9, bell: true });   // the bell-mast landmark
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    kit.box(0.7, 3.2, 0.7, kit.stone, Math.cos(a) * 6, 1.6, sq + Math.sin(a) * 6);   // upright columns
  }
  kit.box(0.2, 4, 0.2, kit.metal, 3.6, 2, sq);         // auctioneer's frame
  kit.box(0.2, 0.2, 2.4, kit.metal, 3.6, 3.8, sq - 1);

  // --- Gateways along the avenue (whole arches) ---
  kit.arch(0, 26, 0, { span: 6, height: 5 });
  kit.arch(0, -31, 0, { span: 5.5, height: 5.5 });
  kit.arch(-9, 2, Math.PI / 2, { span: 5, height: 4.5 });   // toward the market hall

  // --- Returning life ---
  kit.motes(0, -6, 22);
  kit.hibla([
    { pts: [[-8, 2, 30], [-3, 7, 10], [3, 6, -14], [-2, 4, -38]], color: 0x76f4e7, phase: 0.1 },
    { pts: [[8, 2, 28], [3, 8, 6], [-3, 6, -18], [2, 4, -38]], color: 0xffd49a, phase: 0.55 },
  ]);

  // Two slow pans: dolly up the market avenue to the tower, then reveal the
  // market hall and riverside.
  return [
    { t: 0, pos: [-3, 6, 42], look: [0, 3.5, -8] },
    { t: 5.5, pos: [-2, 5, 12], look: [-2, 4, -38] },
    { t: 8, pos: [-14, 8, 2], look: [-26, 4, -6] },     // sweep to the market hall
    { t: 11, pos: [-6, 9, -16], look: [-3, 4.5, -38] }, // settle on the square + tower
  ];
}

// The Dagupan Public Market Hall: a long open-sided gabled hall on posts, its
// bays filled with stalls and baskets of bangus.
function marketHall(kit, cx, cz) {
  const len = 26, halfW = 5;
  for (const sz of [-1, 1]) for (let i = 0; i <= 4; i++) {         // roof posts
    kit.box(0.4, 5, 0.4, kit.wood, cx + sz * halfW, 2.5, cz - len / 2 + (i / 4) * len);
  }
  kit.box(halfW * 2 + 1.5, 0.4, len + 1.5, kit.wood, cx, 5.1, cz);   // ceiling slab
  const roof = kit.cyl(halfW + 1.2, halfW + 1.2, len + 1.5, 3, kit.roof, cx, 6.1, cz);   // gable roof
  roof.rotation.z = 0;
  roof.rotation.x = Math.PI / 2;
  kit.box(halfW * 2, 0.8, len, kit.stone, cx, 0.4, cz);            // raised floor slab
  // interior stalls + bangus baskets
  for (let i = 0; i < 4; i++) {
    const z = cz - len / 2 + 3 + i * 6;
    kit.box(2.4, 0.9, 1.2, kit.wood, cx - 2, 1.25, z);            // vendor tables
    kit.box(2.4, 0.9, 1.2, kit.wood, cx + 2, 1.25, z);
    bangusBasket(kit, cx - 2, 1.9, z);
    bangusBasket(kit, cx + 2, 1.9, z);
  }
  kit.lanternString(cx - halfW, cz - 8, cx - halfW, cz + 8, 4.6, 5, 0xffce7a, 0.4);
  kit.lanternString(cx + halfW, cz - 8, cx + halfW, cz + 8, 4.6, 5, 0xffce7a, 0.4);
}

// A woven basket piled with silver milkfish.
function bangusBasket(kit, x, y, z) {
  kit.cyl(0.45, 0.38, 0.4, 10, kit.wood, x, y, z);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const fish = kit.cyl(0.08, 0.08, 0.55, 6, kit.bangus, x + Math.cos(a) * 0.18, y + 0.28, z + Math.sin(a) * 0.18);
    fish.rotation.z = Math.PI / 2;
    fish.rotation.y = a;
  }
}

// The Pantal riverside: a strip of water lined with bamboo milkfish pens.
function pantalRiverside(kit, x) {
  kit.box(24, 0.1, 96, kit.water, x + 8, 0.05, -2);              // the river
  for (let i = 0; i < 5; i++) {
    const z = 30 - i * 15;
    bambooFishPen(kit, x, z);
  }
}

// A square bamboo fish pen (kasilayan) framing a patch of the river.
function bambooFishPen(kit, x, z) {
  const s = 4;
  for (const [ox, oz] of [[-s, -s], [s, -s], [s, s], [-s, s]]) {
    kit.cyl(0.12, 0.12, 3, 6, kit.bamboo, x + ox, 1.5, z + oz);
  }
  for (const [ax, az, bx, bz] of [[-s, -s, s, -s], [s, -s, s, s], [s, s, -s, s], [-s, s, -s, -s]]) {
    const mx = x + (ax + bx) / 2, mz = (az + bz) / 2 + z;
    const rail = kit.cyl(0.06, 0.06, s * 2, 6, kit.bamboo, mx, 2.4, mz);
    rail.rotation.z = Math.PI / 2;
    rail.rotation.y = (ax === bx) ? Math.PI / 2 : 0;
  }
}
