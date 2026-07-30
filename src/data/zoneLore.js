// ============================================================
// ZONE LORE — the pause menu's recap of each drowned memory
// ============================================================
// Player-facing prose, so it stays in the game's own voice and repeats nothing
// the HUD already says. Every fact here is drawn from the design document and
// the zone modules themselves (STRINGS_GDD.md §8–§10 for the identities and
// encounter shapes, `zones/zoneN.js` for the names and the Guardians), so this
// file is a retelling, not a second source of truth for gameplay numbers.
//
// Filipino/Pangasinan text is intentional — preserve the diacritics and meaning.

export const ZONE_LORE = [
  {
    zone: 1,
    name: 'PONSIA',
    subtitle: 'The market that fed the province',
    guardian: 'Bantay ng Pantal · The Feastkeeper',
    trial: 'Memory Arena — ten waves of drowned echoes, with a bugtong after the third, sixth and tenth.',
    body: 'A commercial spine of stalls, warehouses and cooking spaces, now a cold '
      + 'avenue under the water. PONSIA held the food memory of Pangasinan: eleven '
      + 'dishes and food traditions, from the salt beds of Dasol to the sizzling '
      + 'pans of Dagupan. The stalls are empty, but the memory of shared meals '
      + 'stays in the walls.',
    line: '"Hindi natin malilimutan ang isang bagay na ating minahal."',
    lineEn: '(We cannot forget something we have loved.)',
  },
  {
    zone: 2,
    name: 'LIKET',
    subtitle: 'The festival that was meant to be loud',
    guardian: 'The Reveler',
    trial: 'Memory River — a stationary bangka on a scrolling current; three lantern volleys carry the bugtong.',
    body: 'A parade avenue gone under: lantern strings, bunting, a gong circle, a '
      + 'float graveyard and a parul mast still glowing over the flood. LIKET '
      + 'carried nine Pangasinan festivals — Bangus, Bagoong, Pista’y Dayat and '
      + 'the rest — celebrations of catch, harvest and shore. Joy shared aloud is '
      + 'not a celebration meant for silence.',
    line: '"Ang liket ay hindi tahimik."',
    lineEn: '(Joy is not silent.)',
  },
  {
    zone: 3,
    name: 'PANANISIA',
    subtitle: 'The landmarks that held the province’s faith',
    guardian: 'Ang Tagapag-ingat ng mga Alaala · The Keeper of Memories',
    trial: 'Memory Tower — an eighteen-metre ascent against a rising tide, unsealing three memory seals on the way up.',
    body: 'A drowned cathedral and archive built from Pangasinan’s religious, civic '
      + 'and coastal landmarks: a flooded nave, broken vault ribs, altar ruins and '
      + 'the silhouette of a bell tower. Seven landmarks remember what the province '
      + 'cannot say aloud — shrine, shore and hall, waiting in still meltwater for '
      + 'someone to carry their names back into the light.',
    line: '"Ang bato ay tahimik, ngunit hindi nakakalimot."',
    lineEn: '(The stone is silent, but it does not forget.)',
  },
];
