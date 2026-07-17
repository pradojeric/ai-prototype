// ============================================================
// DATA — artifact payloads + mock City-Wide Portal API (GDD §7/§8)
// ============================================================
// The riddle pool lives in data/riddles.js (split for file-length limits);
// re-exported here so call sites keep importing from './data.js'.
export { RIDDLE_POOL, drawRiddles } from './data/riddles.js';

// Zone-1 provenance label. Per-zone discovery cards read the active zone's
// name (world.zone.name) instead; this remains the fallback / Zone-1 default.
export const ZONE_NAME = 'Pantal Market';

// Mock "City-Wide Portal API" payloads — local, no network. Zone 1's set is the
// "Ponsia" collection: eleven Pangasinan delicacies recovered from the submerged
// Pantal Market. Players surface them three at a time, returning across visits
// until all eleven are restored to the Digital Museum. `image` points at the
// artwork served from assets/ (see ArtifactManager + DiscoveryScreen + Museum).
export const ARTIFACT_DATA = [
  {
    id: 'alaminos_longganisa_001',
    fil: 'Longganisang Alaminos',
    eng: 'Alaminos Longganisa',
    fact: 'A plump, garlicky native sausage from Alaminos City, prized for its coarse-ground pork and bold vinegar-and-garlic cure. Unlike the sweet longganisa of other provinces, the Alaminos version leans savory and sour — a breakfast staple sold in linked rings at Pangasinan markets.',
    note: 'Every town in Pangasinan guards its own longganisa recipe like a family name. To taste Alaminos’ is to taste a place that refused to sweeten itself to please outsiders.',
    spawnTag: 'near_wall',
    image: 'assets/artifacts/zone1/alaminos-longganisa.png',
    zone: 1,
  },
  {
    id: 'dasol_salt_002',
    fil: 'Asin ng Dasol',
    eng: 'Dasol Sea Salt',
    fact: 'Hand-harvested sea salt from the coastal flats of Dasol, where families have raked seawater into shallow beds and let the sun do the rest for generations. The flaky, mineral-rich crystals seasoned the bagoong, the dried fish, and nearly every dish along this shore.',
    note: 'Before refrigeration, salt was survival — it preserved the catch that fed Pangasinan inland. Dasol’s salt beds are a quiet inheritance, worked by hand against cheaper industrial competition.',
    spawnTag: 'open_water',
    image: 'assets/artifacts/zone1/dasol-salt.png',
    zone: 1,
  },
  {
    id: 'kaleskes_003',
    fil: 'Kaleskes',
    eng: 'Tripe & Innards Soup',
    fact: 'A hearty Dagupan soup of beef or carabao innards and tripe, simmered long with rice washings until thick and savory. Sold by the bowl in the city’s eateries, kaleskes turned humble offal into a warming, nose-to-tail comfort food.',
    note: 'Dishes like kaleskes were born of thrift and respect — wasting no part of a costly animal. Its richness is the resourcefulness of a market town made delicious.',
    spawnTag: 'submerged_interior',
    image: 'assets/artifacts/zone1/kaleskes.png',
    zone: 1,
  },
  {
    id: 'pigar_pigar_004',
    fil: 'Pigar-pigar',
    eng: 'Sizzling Sliced Beef',
    fact: 'Dagupan’s most beloved late-night dish — paper-thin beef (and crisp liver) seared fast over fierce heat with rings of onion and fresh greens. Stalls around Pantal kept their iron pans glowing long after the market had closed for the day.',
    note: 'Pigar-pigar remains a living tradition; to eat it sizzling at a roadside stall is to taste a piece of Dagupan that never quite went to sleep.',
    spawnTag: 'elevated_rubble',
    image: 'assets/artifacts/zone1/pigar-pigar.png',
    zone: 1,
  },
  {
    id: 'calasiao_puto_005',
    fil: 'Puto Calasiao',
    eng: 'Calasiao Rice Cakes',
    fact: 'Tiny, pearl-white steamed rice cakes from Calasiao, naturally fermented for a faint tang and a springy bite. Sold by the bagful and eaten by the handful, they are a fixture of fiestas, merienda, and the after-Mass crowd.',
    note: 'Calasiao’s puto carries a geographic pride so strong the town is simply called the "Puto Capital." A humble cake became a whole municipality’s signature.',
    spawnTag: 'near_wall',
    image: 'assets/artifacts/zone1/calasiao-puto.png',
    zone: 1,
  },
  {
    id: 'patupat_006',
    fil: 'Patupat',
    eng: 'Woven Sticky-Rice Pouch',
    fact: 'Glutinous rice packed into diamond pouches woven from young coconut or palm leaves, then boiled and steeped in thick coconut-sugar syrup. The weave is undone by hand to reveal a sweet, sticky block — a festival treat made to be shared.',
    note: 'Patupat is as much craft as cooking; the leaf-weaving is a skill passed mother to child. Each pouch is a small act of patience folded around the harvest.',
    spawnTag: 'submerged_interior',
    image: 'assets/artifacts/zone1/patupat.png',
    zone: 1,
  },
  {
    id: 'bagoong_007',
    fil: 'Bagoong',
    eng: 'Fermented Fish Paste',
    fact: 'Small fish or shrimp salted and left to ferment for months into a pungent, umami-deep paste. In Pangasinan’s coastal kitchens bagoong is the backbone of flavor — a dipping sauce, a souring agent, and the soul of countless vegetable dishes.',
    note: 'Bagoong ties the sea to the table and the present to the past: the same slow fermentation that fed pre-colonial villages still seasons the family meal today.',
    spawnTag: 'open_water',
    image: 'assets/artifacts/zone1/bagoong.png',
    zone: 1,
  },
  {
    id: 'burong_isda_008',
    fil: 'Burong Isda',
    eng: 'Fermented Rice & Fish',
    fact: 'Freshwater fish layered with cooked rice and salt, then left to ferment into a tangy, savory relish (buro). Sautéed with garlic and tomatoes, it transforms a simple catch into a sharp, addictive companion to plain rice and grilled vegetables.',
    note: 'Buro is preservation as artistry — a way the riverside towns of Pangasinan banked the river’s bounty against leaner days, one earthen jar at a time.',
    spawnTag: 'elevated_rubble',
    image: 'assets/artifacts/zone1/burong-isda.png',
    zone: 1,
  },
  {
    id: 'binungey_009',
    fil: 'Binungey',
    eng: 'Bamboo Sticky Rice',
    fact: 'Glutinous rice and coconut milk packed into a length of bamboo and roasted over coals until the cane chars and the rice steams sweet inside. A specialty of western Pangasinan, it is split open and eaten straight from its smoky wooden shell.',
    note: 'Binungey needs no pot and no oven — only bamboo, fire, and know-how. It is fiesta food and field food at once, cooked the way the land itself provides.',
    spawnTag: 'near_wall',
    image: 'assets/artifacts/zone1/binungey.png',
    zone: 1,
  },
  {
    id: 'tupig_010',
    fil: 'Tupig',
    eng: 'Grilled Rice Cake',
    fact: 'Ground glutinous rice and coconut wrapped in banana leaves and grilled over embers until smoky and caramelized at the edges. Sold warm in roadside bundles, tupig is the taste of Pangasinan nights and long bus rides home.',
    note: 'The banana-leaf char and woodsmoke are half the flavor — a reminder that in this province even the wrapping and the fire carry tradition.',
    spawnTag: 'open_water',
    image: 'assets/artifacts/zone1/tupig.png',
    zone: 1,
  },
  {
    id: 'bangus_011',
    fil: 'Bangus',
    eng: 'Milkfish',
    fact: 'The silver milkfish raised in the brackish ponds of Dagupan — celebrated as the sweetest, most tender bangus in the country. The famed Bonuan bangus feeds on natural pond algae, giving its flesh a clean, delicate flavor that made Dagupan the "Bangus Capital of the Philippines."',
    note: 'Bangus is Pangasinan pride made flesh — an entire city’s livelihood, festival (the Bangus Festival), and identity swimming in one fish. To lose it to the flood is to lose the province’s very namesake dish.',
    spawnTag: 'submerged_interior',
    image: 'assets/artifacts/zone1/bangus.png',
    zone: 1,
  },

  // ---- ZONE 2 — "Liket" collection: nine Pangasinan festivals (LIKET, the
  // Festival Zone). Liket is joy; each artifact is a celebration the flood
  // silenced, waiting to be danced back to life in the Digital Museum. ----
  {
    id: 'bagoong_festival_012',
    fil: 'Piyestang Bagoong',
    eng: 'Bagoong Festival',
    fact: 'Lingayen and the fishing towns along the gulf honor bagoong — the salted, sun-fermented fish paste that has flavored Pangasinan cooking for centuries. Streets fill with street-dancing, floats, and stalls of freshly jarred bagoong and its amber fish sauce, patís.',
    note: 'A festival for a humble condiment is really a festival for the sea and the patient labor that preserves its gifts. Liket — joy — is found in giving thanks for what quietly sustains the everyday table.',
    spawnTag: 'near_wall',
    image: 'assets/artifacts/zone2/bagoong-festival.jpg',
    zone: 2,
  },
  {
    id: 'bangus_festival_013',
    fil: 'Piyestang Bangus',
    eng: 'Milkfish Festival',
    fact: 'Dagupan City’s grandest celebration, honoring the sweet Bonuan bangus that made the city the Bangus Capital of the Philippines. Its highlights include the "Gilon" street dance, the bangus rodeo, and a record-breaking grill that stretches down the boulevard in clouds of fragrant smoke.',
    note: 'When a city throws a festival for a single fish, the fish has become far more than food — it is livelihood, identity, and civic pride, all served on one banana leaf.',
    spawnTag: 'open_water',
    image: 'assets/artifacts/zone2/bangus-festival.jpg',
    zone: 2,
  },
  {
    id: 'binungey_festival_014',
    fil: 'Piyestang Binungey',
    eng: 'Bamboo Rice Festival',
    fact: 'Bolinao’s town fiesta built around binungey — glutinous rice and coconut milk roasted inside a length of bamboo until the cane chars and the rice steams sweet within. The festival lines the streets with smoking bamboo and dancers in coastal costume.',
    note: 'Binungey needs only bamboo, fire, and know-how, and so its festival is a quiet boast: this town can conjure a feast from the land itself.',
    spawnTag: 'submerged_interior',
    image: 'assets/artifacts/zone2/binungey-festival.jpg',
    zone: 2,
  },
  {
    id: 'galicayo_festival_015',
    fil: 'Piyestang Galicayo',
    eng: 'Galicayo Festival',
    fact: 'A vibrant Pangasinan town festival of thanksgiving, marked by ground-shaking street-dance competitions, ornate floats, and offerings drawn from the season’s harvest. Colour and rhythm turn the whole plaza into a single moving crowd.',
    note: 'The particular steps may fade from memory, but the impulse behind them endures — a community pausing its labour to dance its gratitude in the open air.',
    spawnTag: 'elevated_rubble',
    image: 'assets/artifacts/zone2/galicayo-festival.jpg',
    zone: 2,
  },
  {
    id: 'mangunguna_festival_016',
    fil: 'Piyestang Mangunguna',
    eng: 'Pioneers’ Festival',
    fact: 'A festival honouring the mangunguna — the "first ones," the pioneers and forebears whose labour founded and fed a Pangasinan town. Processions, tributes, and communal feasting retell the story of those who came before.',
    note: 'To name a festival for the pioneers is to admit a debt: every harvest and every home rests on the hands of people whose names the tide has almost taken.',
    spawnTag: 'near_wall',
    image: 'assets/artifacts/zone2/mangunguna-festival.jpg',
    zone: 2,
  },
  {
    id: 'patupat_festival_017',
    fil: 'Piyestang Patupat',
    eng: 'Patupat Festival',
    fact: 'San Manuel celebrates patupat — glutinous rice packed into diamond pouches woven from palm leaves, boiled and steeped in thick coconut-sugar syrup. The town square fills with the craft of leaf-weaving passed from mother to child.',
    note: 'Each woven pouch is a small act of patience folded around the harvest; a festival of patupat is a festival of the hands that still remember how.',
    spawnTag: 'open_water',
    image: 'assets/artifacts/zone2/patupat-festival.png',
    zone: 2,
  },
  {
    id: 'pindang_festival_018',
    fil: 'Piyestang Pindang',
    eng: 'Cured Meat Festival',
    fact: 'A festival built around pindang — beef or carabao cured with salt and garlic and dried under the Pangasinan sun into a tangy, savoury staple. Grills glow along the streets as the town shares its signature preserved meat.',
    note: 'Before ice and cold storage, drying and curing were how a town banked its meat against lean days; pindang’s festival celebrates thrift turned into flavour.',
    spawnTag: 'submerged_interior',
    image: 'assets/artifacts/zone2/pindang-festival.jpg',
    zone: 2,
  },
  {
    id: 'pistay_dayat_019',
    fil: 'Pista’y Dayat',
    eng: 'Feast of the Sea',
    fact: 'A thanksgiving festival of the coastal towns — Lingayen chief among them — held to honour the sea and pray for a bountiful, gentle harvest of fish. Fluvial parades, beach rites, and offerings carried out over the water mark the first of May.',
    note: 'Pista’y Dayat bows to the same gulf that gives and takes; its gratitude and its plea are the two halves of every fishing life along this shore.',
    spawnTag: 'elevated_rubble',
    image: 'assets/artifacts/zone2/pistay-dayat.webp',
    zone: 2,
  },
  {
    id: 'talong_festival_020',
    fil: 'Piyestang Talong',
    eng: 'Eggplant Festival',
    fact: 'Villasis, the eggplant capital of Pangasinan, honours the humble talong with street-dancing, cooking contests, and towering displays of the glossy purple harvest. Farmers parade the crop that anchors the town’s fields and market.',
    note: 'A whole festival for the eggplant is a farming town’s love letter to its own soil — proof that pride can grow in the most ordinary furrow.',
    spawnTag: 'near_wall',
    image: 'assets/artifacts/zone2/talong-festival.jpeg',
    zone: 2,
  },

  // ---- ZONE 3 — "Pananisia" collection: seven drowned landmarks of
  // Pangasinan. Where zones 1–2 recover food and festival, Pananisia recovers
  // place itself — the monuments, shrines, and shores that hold the province’s
  // memory. ----
  {
    id: 'hundred_islands_021',
    fil: 'Sandaang Isla',
    eng: 'Hundred Islands',
    fact: 'The scattered green-capped islets of the Lingayen Gulf off Alaminos City — some one hundred and twenty-four at low tide — form Pangasinan’s most famous seascape and its first national park. Ancient coral, thought to be thousands of years old, shaped each mushroom-stemmed island.',
    note: 'The islands have watched over the gulf far longer than any town; to see them drowned is to feel how even the oldest, steadiest landmarks are not beyond the reach of the water.',
    spawnTag: 'open_water',
    image: 'assets/artifacts/zone3/hundred-islands.jpg',
    zone: 3,
  },
  {
    id: 'st_james_church_022',
    fil: 'Simbahan ni Santiago Apostol',
    eng: 'St. James the Great Parish Church',
    fact: 'Bolinao’s centuries-old church, raised from coral stone in the early 1600s, its weathered façade carved with folk-Baroque saints and figures. It has stood through storms, fire, and war on the edge of the West Philippine Sea.',
    note: 'Coral hauled from the sea built these walls, and now the sea has come to reclaim them — a landmark returning, stone by stone, to where it began.',
    spawnTag: 'submerged_interior',
    image: 'assets/artifacts/zone3/st-james-church.jpg',
    zone: 3,
  },
  {
    id: 'banaan_023',
    fil: 'Banáan',
    eng: 'Banaan Shore',
    fact: 'A quiet coastal stretch of Pangasinan where pale sand meets the open gulf, long treasured by fishing families and travellers for its calm water and unhurried horizon. Its shoreline gathers the light of every sunset over the sea.',
    note: 'Not every landmark is grand; some are simply the shore a community grew up beside — and their loss is measured in remembered afternoons, not in guidebooks.',
    spawnTag: 'elevated_rubble',
    image: 'assets/artifacts/zone3/banaan.webp',
    zone: 3,
  },
  {
    id: 'bolinao_lighthouse_024',
    fil: 'Parola ng Bolinao',
    eng: 'Cape Bolinao Lighthouse',
    fact: 'Perched on Punta Piedra Point and lit since the early 1900s, the Cape Bolinao Lighthouse is among the tallest in the country, its beam long guiding ships past the rocky western cape. Generations climbed its spiral stair for the view over the sea.',
    note: 'A lighthouse exists to keep others from the deep; there is a hard irony in finding one swallowed by the very water it once warned against.',
    spawnTag: 'near_wall',
    image: 'assets/artifacts/zone3/bolinao-lighthouse.jpg',
    zone: 3,
  },
  {
    id: 'capitol_025',
    fil: 'Kapitolyo ng Pangasinan',
    eng: 'Pangasinan Provincial Capitol',
    fact: 'The stately neoclassical seat of the provincial government in Lingayen, its long colonnade and dome a landmark of civic Pangasinan for over a century. Its grounds face the gulf and the historic Lingayen beach.',
    note: 'The capitol is where a province keeps its records and its self-image; drowned, it becomes an archive of governance the strings must remember on its behalf.',
    spawnTag: 'open_water',
    image: 'assets/artifacts/zone3/capitol.webp',
    zone: 3,
  },
  {
    id: 'manaoag_church_026',
    fil: 'Basílica ng Birhen ng Manaoag',
    eng: 'Basilica of Our Lady of Manaoag',
    fact: 'One of the country’s most visited pilgrimage sites, the Manaoag basilica shelters the centuries-old ivory image of Our Lady of the Rosary, drawing the faithful from across the islands. Its bells and candle-lit shrine have answered prayers for generations.',
    note: 'Manaoag holds the weight of countless whispered petitions; of all the drowned places, a shrine may carry the most memory — every prayer still hanging on the strings.',
    spawnTag: 'submerged_interior',
    image: 'assets/artifacts/zone3/manaoag-church.webp',
    zone: 3,
  },
  {
    id: 'sison_auditorium_027',
    fil: 'Awditoryum ng Sison',
    eng: 'Sison Auditorium',
    fact: 'A landmark Art Deco hall in the Lingayen capitol complex, long the province’s stage for assemblies, ceremonies, and celebrations. Its clean pre-war lines make it one of Pangasinan’s most recognizable public buildings.',
    note: 'An auditorium is a vessel built to be filled with gathered voices; silent and submerged, its emptiness is its own kind of memory.',
    spawnTag: 'elevated_rubble',
    image: 'assets/artifacts/zone3/sison-auditorium.webp',
    zone: 3,
  },
];

// Stand-in for APIManager.fetchArtifactData — async to mirror a real call.
export function fetchArtifactData(id) {
  return new Promise((resolve) => {
    const data = ARTIFACT_DATA.find((a) => a.id === id);
    setTimeout(() => resolve(data), 120); // simulate latency
  });
}

// ------------------------------------------------------------
// GUARDIAN — flavour text for the riddle screen header.
// ------------------------------------------------------------
export const GUARDIAN_TEXT = {
  fil: 'Bantay ng Pantal',
  eng: 'Guardian of the Market',
  intro: 'Sagutin ang aking bugtong upang palayain ang mga alaala.',
  introEng: 'Answer my riddle to free the memories.',
};

