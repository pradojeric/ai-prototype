// ============================================================
// DATA — artifact payloads + mock City-Wide Portal API (GDD §7/§8)
// ============================================================
// The riddle pool lives in data/riddles.js (split for file-length limits);
// re-exported here so call sites keep importing from './data.js'.
export { RIDDLE_POOL, drawRiddles, riddlesForZone } from './data/riddles.js';

// Zone-1 provenance label. Per-zone discovery cards read the active zone's
// name (world.zone.name) instead; this remains the fallback / Zone-1 default.
export const ZONE_NAME = 'PONSIA';

// Mock "City-Wide Portal API" payloads — local, no network. Zone 1's set is the
// "Ponsia" collection: eleven Pangasinan delicacies recovered from the submerged
// PONSIA. Players surface them three at a time, returning across visits
// until all eleven are restored to the Digital Museum. `image` points at the
// artwork served from assets/ (see ArtifactManager + DiscoveryScreen + Museum).
export const ARTIFACT_DATA = [
  {
    id: 'alaminos_longganisa_001',
    fil: 'Longganisang Alaminos',
    eng: 'Alaminos Longganisa',
    origin: 'Longganisang Alaminos developed as the local de recado sausage of Alaminos City. Pork seasoned with garlic, salt, pepper, and vinegar is divided into short links, traditionally marked by the small toothpicks that give each coil its recognizable form.',
    lore: 'Unlike sweeter longganisa traditions, the Alaminos style is known for its savory, garlicky character. Families and market makers preserve their own timpla, making the sausage both an everyday almusal and an edible signature of the city.',
    spawnTag: 'near_wall',
    image: 'assets/artifacts/zone1/alaminos-longganisa.png',
    zone: 1,
  },
  {
    id: 'dasol_salt_002',
    fil: 'Asin ng Dasol',
    eng: 'Dasol Sea Salt',
    origin: 'Dasol’s coastal salt makers draw seawater into shallow beds and rely on sun and wind to leave crystals behind. This long-practiced work belongs to Pangasinan’s wider salt-making heritage—the province’s name is commonly linked to panag-asinan, “where salt is made.”',
    lore: 'Asin once made the sea’s harvest last beyond the day’s catch, preserving fish and giving bagoong its keeping power. Every hand-raked bed therefore carries a history of coastal labor, seasonal knowledge, and food shared far beyond the shore.',
    spawnTag: 'open_water',
    image: 'assets/artifacts/zone1/dasol-salt.png',
    zone: 1,
  },
  {
    id: 'kaleskes_003',
    fil: 'Kaleskes',
    eng: 'Tripe & Innards Soup',
    origin: 'Kaleskes is a Pangasinan soup associated with Dagupan and nearby communities; its name refers to intestines. Beef or carabao meat, tripe, and other lamang-loob are cleaned carefully and simmered into a rich, often annatto-tinted broth.',
    lore: 'Served hot in eateries and roadside stalls, kaleskes reflects a cooking tradition that wastes little of a valuable animal. The patient preparation turns humble cuts into comfort food and keeps the knowledge of Pangasinan’s market kitchens alive.',
    spawnTag: 'submerged_interior',
    image: 'assets/artifacts/zone1/kaleskes.png',
    zone: 1,
  },
  {
    id: 'pigar_pigar_004',
    fil: 'Pigar-pigar',
    eng: 'Sizzling Sliced Beef',
    origin: 'Pigar-pigar became a signature street dish of Dagupan, traditionally using thin slices of carabao meat and now often beef, quickly fried and tossed with onions. Its Pangasinan name is associated with repeatedly turning the meat as it cooks.',
    lore: 'The dish belongs to Dagupan’s evening food culture, where cooks work over hot pans and serve each order at once. Shared as pulutan or a full meal, pigar-pigar turns a simple technique into a lively ritual of gathering.',
    spawnTag: 'elevated_rubble',
    image: 'assets/artifacts/zone1/pigar-pigar.png',
    zone: 1,
  },
  {
    id: 'calasiao_puto_005',
    fil: 'Puto Calasiao',
    eng: 'Calasiao Rice Cakes',
    origin: 'Puto Calasiao is the small steamed rice cake identified with the town of Calasiao. Rice is soaked, ground, and naturally fermented before steaming, a process that gives the bite-sized puto its soft texture and gently sweet, faintly tangy flavor.',
    lore: 'Rows of puto stalls have made the delicacy inseparable from Calasiao’s public identity. Bought for merienda, fiestas, pasalubong, or the journey home after Mass, each bundle carries a household craft into the life of the town.',
    spawnTag: 'near_wall',
    image: 'assets/artifacts/zone1/calasiao-puto.png',
    zone: 1,
  },
  {
    id: 'patupat_006',
    fil: 'Patupat',
    eng: 'Woven Sticky-Rice Pouch',
    origin: 'Patupat is made by filling diamond-shaped pouches woven from coconut leaves with glutinous rice, then cooking them in sweetened sugarcane juice. The delicacy is strongly associated with communities including Pozorrubio, Manaoag, Balungao, and Alaminos.',
    lore: 'Its wrapper makes patupat both food and handcraft: the rice cannot be cooked in its familiar form until the leaves are woven correctly. Preparing many pouches for a fiesta or family gathering preserves skills carried through practice rather than written recipes.',
    spawnTag: 'submerged_interior',
    image: 'assets/artifacts/zone1/patupat.png',
    zone: 1,
  },
  {
    id: 'bagoong_007',
    fil: 'Bagoong',
    eng: 'Fermented Fish Paste',
    origin: 'Bagoong is produced by salting fish or shrimp and allowing time and fermentation to transform the mixture. Lingayen is especially known for bagoong isda and the amber patis drawn from it, supported by the fisheries of Lingayen Gulf.',
    lore: 'The jar embodies an old preservation lesson: salt, patience, and careful tending can extend the sea’s abundance. Used as sawsawan or seasoning for vegetables and rice, bagoong remains a strong, everyday expression of Pangasinan taste.',
    spawnTag: 'open_water',
    image: 'assets/artifacts/zone1/bagoong.png',
    zone: 1,
  },
  {
    id: 'burong_isda_008',
    fil: 'Burong Isda',
    eng: 'Fermented Rice & Fish',
    origin: 'Burong isda belongs to a wider Central and Northern Luzon tradition of fermenting fish with cooked rice and salt. In Pangasinan households, the matured buro is commonly sautéed with garlic, onion, or tomato before it reaches the table.',
    lore: 'Fermentation allowed families to keep part of a freshwater catch for later meals, turning necessity into a prized sour-savory accompaniment. The changing aroma and taste of each jar also record the judgment of the cook who tended it.',
    spawnTag: 'elevated_rubble',
    image: 'assets/artifacts/zone1/burong-isda.png',
    zone: 1,
  },
  {
    id: 'binungey_009',
    fil: 'Binungey',
    eng: 'Bamboo Sticky Rice',
    origin: 'Binungey is a sticky-rice delicacy closely associated with Anda and other parts of western Pangasinan. Glutinous rice and coconut milk are sealed inside bamboo and cooked slowly over charcoal or wood fire until the rice sets within the tube.',
    lore: 'Bamboo serves as vessel, steamer, and wrapper, showing how cooks shaped a delicacy from materials close at hand. Split open and shared with sugar, caramel, or ripe mango, binungey has become a marker of Andanian hospitality.',
    spawnTag: 'near_wall',
    image: 'assets/artifacts/zone1/binungey.png',
    zone: 1,
  },
  {
    id: 'tupig_010',
    fil: 'Tupig',
    eng: 'Grilled Rice Cake',
    origin: 'Tupig is a kakanin of northwestern Luzon, especially Pangasinan and neighboring Ilocos communities. Ground glutinous rice, coconut, and sugar are wrapped in banana leaves and grilled directly over coals, which caramelize the filling and perfume it with smoke.',
    lore: 'Because tupig travels well in its leaf wrapper, it became familiar as pasalubong and roadside food. Its flavor depends not only on the rice mixture but also on the maker’s control of ember, leaf, and timing.',
    spawnTag: 'open_water',
    image: 'assets/artifacts/zone1/tupig.png',
    zone: 1,
  },
  {
    id: 'bangus_011',
    fil: 'Bangus',
    eng: 'Milkfish',
    origin: 'Bangus, the Philippines’ national fish, has long been raised in the brackish ponds and river systems around Dagupan. The city’s fishpond culture and trading network made Bonuan bangus a celebrated local product and Dagupan a national center of milkfish production.',
    lore: 'For Dagupeños, bangus is livelihood, daily food, and civic identity at once. Pond tending, harvesting, deboning, cooking, and selling connect many hands, while the Bangus Festival makes that shared dependence visible in the streets.',
    spawnTag: 'submerged_interior',
    image: 'assets/artifacts/zone1/bangus.png',
    zone: 1,
  },

  // ---- ZONE 2 — "Liket" collection: nine Pangasinan festivals (LIKET, the
  // Festival Zone). Liket is joy; each artifact is a celebration the flood
  // silenced, waiting to be danced back to life in the Digital Museum. ----
  {
    id: 'bagoong_festival_012',
    fil: 'Pista ng Bagoong',
    eng: 'Bagoong Festival',
    origin: 'Lingayen established the Bagoong Festival around its best-known one-town, one-product industry. Held with the town fiesta, the celebration promotes the makers of bagoong isda and patis whose salted, fermented products have long linked the capital town to Lingayen Gulf.',
    lore: 'Street performances, trade displays, and visits to local producers honor more than a condiment. They make visible the fishers, salters, fermenters, vendors, and family enterprises behind a flavor found on Pangasinan tables.',
    spawnTag: 'near_wall',
    image: 'assets/artifacts/zone2/bagoong-festival.png',
    zone: 2,
  },
  {
    id: 'bangus_festival_013',
    fil: 'Pista ng Bangus',
    eng: 'Bangus Festival',
    origin: 'Dagupan’s Bangus Festival grew from Gilon, a ceremonial bangus harvest presented for returning balikbayan in the early 1990s, and developed into a citywide celebration. Its program honors the milkfish industry through dance, culinary events, and communal grilling.',
    lore: 'Gilon-gilon dancers translate the movement and labor of harvesting bangus into performance. When thousands gather around grills and streets, the festival turns an industry sustained by ponds and rivers into a public declaration of Dagupeño pride.',
    spawnTag: 'open_water',
    image: 'assets/artifacts/zone2/bangus-festival.png',
    zone: 2,
  },
  {
    id: 'binungey_festival_014',
    fil: 'Pista ng Binungey',
    eng: 'Binungey Festival',
    origin: 'Anda celebrates the Binungey Festival each April around its foundation anniversary and its signature bamboo-cooked rice cake. The event brings a household delicacy into public view through cooking, cultural presentations, and community activities.',
    lore: 'For Andanians, binungey represents more than sticky rice in bamboo: it evokes the island town’s coconut, bamboo, fire, and shared labor. The festival uses a familiar food to express gratitude and strengthen a sense of belonging.',
    spawnTag: 'submerged_interior',
    image: 'assets/artifacts/zone2/binungey-festival.png',
    zone: 2,
  },
  {
    id: 'galicayo_festival_015',
    fil: 'Pista ng Galicayo',
    eng: 'Galicayo Festival',
    origin: 'Galicayo Festival is a cultural and religious celebration in Manaoag honoring Our Lady of Manaoag, regarded as the patroness of Pangasinan. Delegations from different towns gather in December with performances that present local festivals and traditions.',
    lore: 'The name recalls a province assembling around devotion: prayer, pilgrimage, music, and dance meet in one place. Galicayo allows each community to bring its own identity while acknowledging a Marian tradition shared across Pangasinan.',
    spawnTag: 'elevated_rubble',
    image: 'assets/artifacts/zone2/galicayo-festival.png',
    zone: 2,
  },
  {
    id: 'mangunguna_festival_016',
    fil: 'Pista ng Mangunguna',
    eng: 'Fishermen’s Festival',
    origin: 'Bolinao created the Mangunguna Festival in recognition of the fishing and aquaculture industries that sustain the coastal town. In local usage, mangunguna refers to fisherfolk, whose work anchors the celebration’s parades, contests, and cultural events.',
    lore: 'The festival places fishing families at the center of Bolinao’s story. It honors knowledge of seasons, currents, boats, nets, and coastal waters while reminding visitors that the town’s celebrated seafood begins with demanding work at sea.',
    spawnTag: 'near_wall',
    image: 'assets/artifacts/zone2/mangunguna-festival.png',
    zone: 2,
  },
  {
    id: 'patupat_festival_017',
    fil: 'Pista ng Patupat',
    eng: 'Patupat Festival',
    origin: 'Pozorrubio’s Patupat Festival highlights the town’s well-known sticky-rice delicacy during its annual fiesta. Patupat is enclosed in woven coconut leaves and cooked in sweet sugarcane juice, joining rice farming, weaving, and cooking in one craft.',
    lore: 'Street dancing enlarges the small diamond pouch into a symbol of Pozorrubio. By celebrating patupat publicly, the town honors the growers, leaf weavers, cooks, and vendors who keep a labor-intensive merienda in community memory.',
    spawnTag: 'open_water',
    image: 'assets/artifacts/zone2/patupat-festival.png',
    zone: 2,
  },
  {
    id: 'pindang_festival_018',
    fil: 'Pista ng Pindang',
    eng: 'Pindang Festival',
    origin: 'Mangaldan holds the Pindang Festival with its town fiesta to promote pindang, the locality’s seasoned and cured carabao or beef product. The celebration grew around a trade that supports meat processors, market sellers, cooks, and farming families.',
    lore: 'Curing meat with salt and seasonings began as practical preservation and became a flavor associated with Mangaldan. Through food fairs and public festivities, pindang carries household technique into the town’s collective identity.',
    spawnTag: 'submerged_interior',
    image: 'assets/artifacts/zone2/pindang-festival.png',
    zone: 2,
  },
  {
    id: 'pistay_dayat_019',
    fil: 'Pista’y Dayat',
    eng: 'Feast of the Sea',
    origin: 'Pista’y Dayat—“Feast of the Sea”—is Pangasinan’s provincial thanksgiving for the bounty of its waters and the labor of fishing communities. Traditionally associated with May celebrations along Lingayen Gulf, it has grown into a wider program of civic, cultural, and coastal events.',
    lore: 'The gathering expresses both gratitude and dependence: the dayat provides food and livelihood, yet demands respect from those who cross it. Fluvial and shoreline activities renew the relationship between Pangasinenses and the gulf that shapes provincial life.',
    spawnTag: 'elevated_rubble',
    image: 'assets/artifacts/zone2/pistay-dayat.png',
    zone: 2,
  },
  {
    id: 'talong_festival_020',
    fil: 'Pista ng Talong',
    eng: 'Talong Festival',
    origin: 'Villasis established the Talong Festival to celebrate the eggplant crop for which the farming town is known. Held alongside its fiesta, the program has featured street dancing, cooking events, produce displays, and communal grilling.',
    lore: 'Elevating talong into a festival symbol recognizes the farmers whose harvest supplies markets within and beyond Pangasinan. The celebration turns an ordinary vegetable into a statement of agricultural skill, abundance, and hometown pride.',
    spawnTag: 'near_wall',
    image: 'assets/artifacts/zone2/talong-festival.png',
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
    origin: 'Hundred Islands National Park lies in Lingayen Gulf off Alaminos City and contains 124 islands at low tide. The islets are ancient limestone and coral formations shaped over long periods by uplift, weather, and the action of the sea.',
    lore: 'Declared a national park in 1940, the archipelago became Pangasinan’s best-known natural landmark. Its coves, cliffs, fishing grounds, and changing count between tides bind tourism and coastal life to a landscape that is never entirely still.',
    spawnTag: 'open_water',
    image: 'assets/artifacts/zone3/hundred-islands.png',
    zone: 3,
  },
  {
    id: 'st_james_church_022',
    fil: 'Simbahan ni Santiago Apostol',
    eng: 'St. James the Great Parish Church',
    origin: 'The parish of St. James the Great in Bolinao traces its roots to the early seventeenth century. Its church was built and rebuilt in stone across generations, using the durable coral material common to many coastal churches.',
    lore: 'The church has served as a center of worship through storms, conflict, and changes in colonial rule. Its weathered walls hold the labor of local builders and the repeated acts of repair by a community determined to keep its parish standing.',
    spawnTag: 'submerged_interior',
    image: 'assets/artifacts/zone3/st-james-church.png',
    zone: 3,
  },
  {
    id: 'banaan_023',
    fil: 'Banáan na Museo ng Pangasinan',
    eng: 'Banáan Pangasinan Provincial Museum',
    origin: 'Banáan Pangasinan Provincial Museum opened in 2023 inside Lingayen’s restored Casa Real. The Spanish-period building once served as the provincial seat of government; its new name uses banáan, a Pangasinan word for a meeting place.',
    lore: 'Across eleven galleries, the museum brings archaeology, history, art, language, and living traditions into conversation. Housing these stories in Casa Real transforms an old center of colonial authority into a meeting place where Pangasinenses can interpret their own past.',
    spawnTag: 'elevated_rubble',
    image: 'assets/artifacts/zone3/banaan.png',
    zone: 3,
  },
  {
    id: 'bolinao_lighthouse_024',
    fil: 'Parola ng Bolinao',
    eng: 'Cape Bolinao Lighthouse',
    origin: 'Cape Bolinao Lighthouse was built in 1905 on Punta Piedra Point in Patar, Bolinao. Its tower rises from a high rocky headland, giving the beacon a commanding position over the West Philippine Sea.',
    lore: 'The parola belongs to a chain of navigational landmarks that made dangerous coasts more legible to mariners. Even after its original lamp ceased regular service, its silhouette remained a reminder of seafaring, engineering, and Bolinao’s outward-looking coast.',
    spawnTag: 'near_wall',
    image: 'assets/artifacts/zone3/bolinao-lighthouse.png',
    zone: 3,
  },
  {
    id: 'capitol_025',
    fil: 'Kapitolyo ng Pangasinan',
    eng: 'Pangasinan Provincial Capitol',
    origin: 'The Pangasinan Provincial Capitol was constructed in Lingayen during the administration of Governor Daniel Maramba and completed in 1918. Its monumental neoclassical design placed the provincial government within a formal civic complex facing Lingayen Gulf.',
    lore: 'For more than a century, the capitol has represented provincial government in both ceremony and daily administration. Its columns, dome, halls, and public grounds give physical form to Pangasinan’s civic life and collective record.',
    spawnTag: 'open_water',
    image: 'assets/artifacts/zone3/capitol.png',
    zone: 3,
  },
  {
    id: 'manaoag_church_026',
    fil: 'Basílica ng Birhen ng Manaoag',
    eng: 'Basilica of Our Lady of Manaoag',
    origin: 'The shrine of Our Lady of the Rosary of Manaoag grew from an early Catholic mission in the area once called Santa Monica. Its venerated Marian image survived revolution and upheaval, received a canonical coronation in 1926, and is now enshrined in a minor basilica.',
    lore: 'Generations of pilgrims have come to Manaoag with petitions, candles, vows, and thanksgiving. The basilica’s meaning lives as much in these repeated journeys and remembered answered prayers as in the building and sacred image themselves.',
    spawnTag: 'submerged_interior',
    image: 'assets/artifacts/zone3/manaoag-church.png',
    zone: 3,
  },
  {
    id: 'sison_auditorium_027',
    fil: 'Awditoryum ng Sison',
    eng: 'Sison Auditorium',
    origin: 'Built in 1926–1927 in Lingayen’s capitol complex, the hall was first known as the Grand Provincial Auditorium. It was later named for Teofilo Sison, a Pangasinan governor who went on to serve as secretary of national defense.',
    lore: 'The auditorium hosted zarzuela, cultural performances, assemblies, graduations, and civic ceremonies before and after the war. Its history is therefore carried not only by architecture, but by the many voices and audiences that repeatedly filled the hall.',
    spawnTag: 'elevated_rubble',
    image: 'assets/artifacts/zone3/sison-auditorium.png',
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
