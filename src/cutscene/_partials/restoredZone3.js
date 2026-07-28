// ============================================================
// RESTORED ZONE 3 — PANANISIA (landmarks), whole and lit again.
// ============================================================
// Zone 3's archive is the seven drowned LANDMARKS of Pangasinan (see data.js),
// so the restored zone is the St. John the Evangelist Cathedral (Dagupan) made
// whole — a buttressed brick facade with a single side belfry, a nave colonnade
// bridged by vault ribs, and the campanile terminus — standing at the centre of
// a restored landmark skyline: the twin-towered Basilica of Our Lady of Manaoag
// (W), the neoclassical Pangasinan Provincial Capitol with its dome (E), the
// white Cape Bolinao Lighthouse on its rocky headland, and the Hundred Islands
// out in the gulf (N). The closing wide lift reveals them all together.
const PILLAR_ROWS = [22, 16, 10, 4, -2, -8];   // z stations, S → N (mirrors zone3)
const TALL_ROWS = new Set([22, 4, -8]);

export function buildRestoredZone3(kit, group) {
  kit.setGroup(group);
  kit.ground(96, 9, kit.limestone);            // pale restored cathedral floor down the nave
  kit.dock(34);

  cathedralFacade(kit);                        // St. John facade + single belfry at the narthex (S)
  naveAndSanctuary(kit);                       // colonnade, vault ribs, transepts, altar, campanile

  // --- The restored landmark skyline around the cathedral ---
  manaoagBasilica(kit, -46, -20);              // W: twin bell towers + dome
  provincialCapitol(kit, 46, -18);             // E: neoclassical colonnade + dome
  casaReal(kit, -44, 10);                       // SW: Spanish colonial arcade (Banáan museum)
  hundredIslands(kit, -66);                    // far N: limestone islets in the gulf
  bolinaoLighthouse(kit, 30, -58);             // far NE headland: white tapered tower

  // --- Memory strings + drifting light ---
  const specs = [];
  for (let i = 0; i < PILLAR_ROWS.length - 1; i++) {
    const z0 = PILLAR_ROWS[i], z1 = PILLAR_ROWS[i + 1];
    specs.push({ pts: [[-6, 5, z0], [0, 7, (z0 + z1) / 2], [6, 5, z1]], color: 0x9fd4e8, phase: i / 6 });
  }
  specs.push({ pts: [[-6, 5, -8], [-2, 4, -13], [0, 3, -18]], color: 0xdfeffc, phase: 0.35 });
  specs.push({ pts: [[6, 5, -8], [2, 4, -13], [0, 3, -18]], color: 0xdfeffc, phase: 0.7 });
  kit.hibla(specs);
  kit.motes(0, -2, 18);

  // Slow pan up the nave to the altar and campanile, then the closing wide lift
  // that reveals the full restored landmark skyline.
  return [
    { t: 0, pos: [0, 5, 40], look: [0, 6, 8] },        // establish the cathedral facade
    { t: 5, pos: [0, 3.6, 14], look: [0, 3.8, -18] },  // through the portal, down the nave
    { t: 9, pos: [0, 5, -4], look: [-3, 10, -38] },    // to the altar + campanile
    { t: 13.5, pos: [0, 36, 66], look: [0, 5, -26] },  // finale: wide lift over the landmark skyline
  ];
}

// St. John the Evangelist Cathedral facade: a buttressed brick front with a
// central gabled portal (open, so the camera flies through) and one tall side
// belfry — the real cathedral's single-tower silhouette.
function cathedralFacade(kit) {
  const z = 27;
  // flanking buttressed facade blocks (leave the centre open for the portal)
  for (const sx of [-1, 1]) {
    kit.box(6, 9, 4, kit.brick, sx * 8, 4.5, z);
    for (const bz of [-1.6, 1.6]) kit.box(1, 10, 1, kit.brick, sx * 10.6, 5, z + bz);   // buttress fins
  }
  // upper gable spanning the portal, with a rose window + pediment
  kit.box(12, 3.2, 3.6, kit.brick, 0, 8.6, z);
  kit.pediment(13, 3.2, 3.6, kit.brick, 0, 10.2, z + 1.8);
  const rose = kit.cyl(1.15, 1.15, 0.3, 16, kit.skyBlue, 0, 8.4, z + 1.85);
  rose.rotation.x = Math.PI / 2;
  kit.arch(0, z - 0.6, 0, { span: 6, height: 6 });       // open central portal
  // single side belfry (west), taller than the facade, capped with a spire + cross
  const bx = -13;
  kit.box(4.4, 20, 4.4, kit.brick, bx, 10, z);
  for (const sz of [-1, 1]) kit.box(1.4, 2.2, 0.4, kit.shutter, bx, 16, z + sz * 2.25);  // belfry louvres
  kit.box(1.4, 0.4, 2.4, kit.shutter, bx, 16, z);
  kit.box(4.8, 0.5, 4.8, kit.limestone, bx, 20.4, z);    // cornice
  kit.cone(3, 4.5, 4, kit.roof, bx, 22.9, z);            // spire
  kit.box(0.2, 1.6, 0.2, kit.gold, bx, 25.6, z);         // cross
  kit.box(1, 0.2, 0.2, kit.gold, bx, 25.9, z);
  kit.lantern(0, 6.8, z + 1.9, 0x9fd4e8, 1.6);           // lit rose window
}

// Nave colonnade + vault ribs + transepts + altar/apse + the campanile terminus.
function naveAndSanctuary(kit) {
  const pillarY = {};
  for (const zr of PILLAR_ROWS) {
    const h = TALL_ROWS.has(zr) ? 12 : 6.5;
    for (const s of [-1, 1]) kit.pillar(s * 6, zr, h, 1.2);
    // low nave walls with buttresses behind the aisles
    if (zr % 12 === 10 || TALL_ROWS.has(zr)) for (const s of [-1, 1]) kit.box(1, 7, 1, kit.brick, s * 9, 3.5, zr);
    pillarY[zr] = h;
  }
  for (const zr of TALL_ROWS) kit.vaultRib(zr, { radius: 6, y: pillarY[zr] - 0.5 });

  // transepts (whole chapel wings E + W of the crossing)
  kit.box(10, 8, 7, kit.brick, -20, 4, 1, Math.PI / 2);
  kit.box(10, 8, 7, kit.brick, 20, 4, 1, -Math.PI / 2);
  kit.arch(-11, -1, Math.PI / 2, { span: 5, height: 4.5 });
  kit.arch(11, -1, Math.PI / 2, { span: 5, height: 4.5 });
  kit.lantern(-20, 5, -2, 0x9fd4e8, 1.8);
  kit.lantern(20, 5, -2, 0x9fd4e8, 1.8);

  // altar + apse
  const cz = -18;
  kit.dais(0, cz, 3.8);
  kit.box(2.4, 1.1, 1.1, kit.white, 0, 0.8, cz - 0.5);
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.15 + 0.7 * (i / 6));
    kit.pillar(Math.cos(a) * 8, cz - 2 - Math.sin(a) * 6, 4 + (i % 3), 0.8);
  }
  kit.lanternCluster(-2.4, cz + 1.5, { count: 5, y: 2.6, radius: 0.9, color: 0xffdca0 });
  kit.lanternCluster(2.6, cz - 0.5, { count: 4, y: 3.0, radius: 0.7, color: 0xffdca0 });

  // campanile terminus (the surviving bell-tower, whole)
  kit.tower(-4, -38, { height: 20, baseR: 2.4, mat: kit.brick, bell: true });
}

// Basilica of Our Lady of Manaoag: twin bell towers flanking a pedimented
// facade, with a dome rising behind — the province's Marian landmark.
function manaoagBasilica(kit, x, z) {
  kit.box(16, 6, 3, kit.capitolStone, x, 6, z);                 // raised terrace plinth (elevated)
  kit.box(11, 9, 9, kit.capitolStone, x, 12.5, z - 1);          // nave body
  kit.box(9, 4, 3, kit.capitolStone, x, 12, z + 4);            // facade block
  kit.pediment(9, 2.6, 3, kit.capitolStone, x, 14, z + 5.5);
  const rose = kit.cyl(0.9, 0.9, 0.3, 16, kit.skyBlue, x, 12.6, z + 5.6);
  rose.rotation.x = Math.PI / 2;
  for (const sx of [-1, 1]) {                                   // twin bell towers
    kit.box(3.2, 16, 3.2, kit.capitolStone, x + sx * 6, 12, z + 3);
    kit.box(3.6, 0.5, 3.6, kit.white, x + sx * 6, 20.4, z + 3);
    kit.cone(2.4, 3.4, 4, kit.roof, x + sx * 6, 22.4, z + 3);
    kit.box(0.15, 1.4, 0.15, kit.gold, x + sx * 6, 24.6, z + 3);
  }
  kit.dome(3.4, kit.verdigris, x, 17, z - 2);                   // central dome
  kit.cyl(0.3, 0.3, 1.4, 8, kit.gold, x, 20.6, z - 2);         // dome finial
}

// Pangasinan Provincial Capitol (Lingayen, 1918): a monumental neoclassical
// block fronted by a colonnade and pediment, crowned by a central dome.
function provincialCapitol(kit, x, z) {
  kit.box(22, 5, 3, kit.capitolStone, x, 5, z);                 // stylobate / stairs plinth
  kit.box(20, 9, 12, kit.capitolStone, x, 12, z - 4);          // main block
  kit.columnRow(x - 8, z + 2, x + 8, z + 2, 8, 9, 0.7, kit.white);   // portico colonnade
  kit.box(19, 2, 3, kit.capitolStone, x, 17, z + 2);           // entablature over the columns
  kit.pediment(19, 3, 3, kit.capitolStone, x, 19, z + 3.5);
  kit.box(7, 3, 7, kit.capitolStone, x, 17.5, z - 4);          // drum base for the dome
  kit.dome(4.6, kit.verdigris, x, 19, z - 4);                  // central dome
  kit.cyl(0.35, 0.35, 1.8, 8, kit.gold, x, 24, z - 4);        // dome finial
}

// Casa Real / Banáan Provincial Museum: a two-storey Spanish colonial block
// with a ground-floor arcade of round arches.
function casaReal(kit, x, z) {
  kit.box(14, 8, 8, kit.wall, x, 4, z);
  const roof = kit.cyl(4.6, 4.6, 14.4, 3, kit.roof, x, 8.4, z);   // hip/gable roof prism
  roof.rotation.z = Math.PI / 2;
  for (let i = -2; i <= 2; i++) {                                 // ground arcade
    kit.arch(x + i * 3, z + 4.1, 0, { span: 2.2, height: 3 });
    kit.box(1.2, 1.8, 0.2, kit.shutter, x + i * 3, 5.6, z + 4.05); // upper capiz windows
  }
}

// Cape Bolinao Lighthouse (1905): a tall WHITE tapered stone tower on a rocky
// headland, with a keeper's house at the base, a gallery ring, and a glazed
// lantern room under a small dome. (White — never red-striped.)
function bolinaoLighthouse(kit, x, z) {
  // rocky headland it rises from
  for (const [ox, oz, r] of [[0, 0, 7], [-4, 3, 4], [5, -2, 3.5], [2, 5, 3]]) {
    const rock = kit.sphere(r, kit.isletRock, x + ox, r * 0.35, z + oz, 9, 7);
    rock.scale.y = 0.5;
  }
  kit.box(7, 4, 6, kit.lightWhite, x, 4.5, z);                  // keeper's house
  const roof = kit.cyl(2.6, 2.6, 7.4, 3, kit.roof, x, 7, z);
  roof.rotation.z = Math.PI / 2;
  kit.cyl(1.3, 1.9, 22, 14, kit.lightWhite, x, 13.5, z);       // tapered tower shaft
  kit.cyl(2.0, 2.0, 0.5, 14, kit.wall, x, 24.8, z);           // gallery ring
  kit.cyl(1.4, 1.4, 2.2, 12, kit.skyBlue, x, 26.1, z);        // glazed lantern room
  kit.dome(1.5, kit.roof, x, 27.2, z);                        // cap dome
  kit.lantern(x, 26.1, z, 0xfff0c0, 3.4);                      // the relit beacon
}

// Hundred Islands: a strip of gulf water dotted with green-capped limestone
// islets out beyond the cathedral apse.
function hundredIslands(kit, z) {
  const water = kit.box(320, 0.1, 60, kit.water, 0, 0.05, z);
  void water;
  const spots = [[-40, 6, 5], [-22, -8, 4], [-6, 10, 6], [10, -6, 4.5], [26, 8, 5], [44, -4, 4], [-56, 4, 3.5], [58, 6, 4]];
  for (const [ox, oz, r] of spots) {
    const rock = kit.sphere(r, kit.isletRock, ox, r * 0.55, z + oz, 9, 7);
    rock.scale.set(1, 1.15, 0.9);
    const cap = kit.sphere(r * 0.9, kit.green, ox, r * 1.05, z + oz, 8, 6);
    cap.scale.y = 0.5;
  }
}
