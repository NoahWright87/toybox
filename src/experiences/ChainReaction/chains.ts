export interface ChainPair {
  display: string;  // e.g. "FIREWORKS" or "FAST FOOD"
  hint?: string;    // optional explanation for the "wtf?" feature
}

export interface Chain {
  words: string[];     // all words including START and END
  pairs: ChainPair[];  // pairs[i] describes words[i] + words[i+1]
}

export const CHAINS: Record<"quick" | "normal" | "long", Chain[]> = {

  // ── Quick: 4 words, 2 mystery ────────────────────────────────────────────
  quick: [
    {
      words: ["FIRE", "WORKS", "SHOP", "LIFT"],
      pairs: [
        { display: "FIREWORKS", hint: "Explosive celebration" },
        { display: "WORKSHOP", hint: "Where craftspeople work" },
        { display: "SHOPLIFT", hint: "To steal from a store" },
      ],
    },
    {
      words: ["OVER", "NIGHT", "STAND", "OFF"],
      pairs: [
        { display: "OVERNIGHT", hint: "Lasting through the night" },
        { display: "NIGHTSTAND", hint: "Bedside table" },
        { display: "STANDOFF", hint: "A deadlock between two sides" },
      ],
    },
    {
      words: ["NEWS", "PAPER", "BACK", "BONE"],
      pairs: [
        { display: "NEWSPAPER", hint: "Printed daily news" },
        { display: "PAPERBACK", hint: "A soft-cover book" },
        { display: "BACKBONE", hint: "Spine; also: courage" },
      ],
    },
    {
      words: ["FLASH", "LIGHT", "HOUSE", "HOLD"],
      pairs: [
        { display: "FLASHLIGHT", hint: "Handheld battery lamp" },
        { display: "LIGHTHOUSE", hint: "Tower that guides ships" },
        { display: "HOUSEHOLD", hint: "Everyone living in a home" },
      ],
    },
    {
      words: ["SUN", "FLOWER", "BED", "ROOM"],
      pairs: [
        { display: "SUNFLOWER", hint: "Tall yellow bloom" },
        { display: "FLOWERBED", hint: "A garden planting area" },
        { display: "BEDROOM", hint: "Where you sleep" },
      ],
    },
    {
      words: ["DOOR", "BELL", "BOY", "FRIEND"],
      pairs: [
        { display: "DOORBELL", hint: "Button that rings a chime" },
        { display: "BELLBOY", hint: "Hotel luggage porter" },
        { display: "BOYFRIEND", hint: "Male romantic partner" },
      ],
    },
    {
      words: ["FOOT", "NOTE", "BOOK", "WORM"],
      pairs: [
        { display: "FOOTNOTE", hint: "Small text at page bottom" },
        { display: "NOTEBOOK", hint: "A writing journal" },
        { display: "BOOKWORM", hint: "An avid reader" },
      ],
    },
    {
      words: ["SNOW", "BALL", "ROOM", "MATE"],
      pairs: [
        { display: "SNOWBALL", hint: "Packed sphere of snow" },
        { display: "BALLROOM", hint: "Large formal dance hall" },
        { display: "ROOMMATE", hint: "Someone you share a home with" },
      ],
    },
    {
      words: ["HAND", "SHAKE", "DOWN", "TOWN"],
      pairs: [
        { display: "HANDSHAKE", hint: "A greeting between two people" },
        { display: "SHAKEDOWN", hint: "A forced extraction of money" },
        { display: "DOWNTOWN", hint: "The city center" },
      ],
    },
    {
      words: ["DAY", "DREAM", "LAND", "MARK"],
      pairs: [
        { display: "DAYDREAM", hint: "A waking fantasy" },
        { display: "DREAMLAND", hint: "An imaginary perfect place" },
        { display: "LANDMARK", hint: "A recognizable place or turning point" },
      ],
    },
    {
      words: ["GOLD", "MINE", "FIELD", "WORK"],
      pairs: [
        { display: "GOLDMINE", hint: "An extremely profitable source" },
        { display: "MINEFIELD", hint: "Dangerous territory to navigate" },
        { display: "FIELDWORK", hint: "Research done outside the lab" },
      ],
    },
    {
      words: ["BLACK", "BIRD", "HOUSE", "HOLD"],
      pairs: [
        { display: "BLACKBIRD", hint: "A common songbird" },
        { display: "BIRDHOUSE", hint: "A wooden nesting box" },
        { display: "HOUSEHOLD", hint: "All residents of a home" },
      ],
    },
    {
      words: ["THUNDER", "STORM", "CLOUD", "BURST"],
      pairs: [
        { display: "THUNDERSTORM", hint: "A storm with lightning and thunder" },
        { display: "STORM CLOUD", hint: "A heavy dark threatening cloud" },
        { display: "CLOUDBURST", hint: "A sudden heavy downpour" },
      ],
    },
    {
      words: ["CANDLE", "LIGHT", "HOUSE", "WIFE"],
      pairs: [
        { display: "CANDLELIGHT", hint: "Soft glow of a flame" },
        { display: "LIGHTHOUSE", hint: "A beacon that guides ships" },
        { display: "HOUSEWIFE", hint: "A homemaker" },
      ],
    },
    {
      words: ["MOON", "LIGHT", "HOUSE", "BOAT"],
      pairs: [
        { display: "MOONLIGHT", hint: "Light from the moon; also: to work two jobs" },
        { display: "LIGHTHOUSE", hint: "A tower with a warning light" },
        { display: "HOUSEBOAT", hint: "A boat used as a home" },
      ],
    },
    {
      words: ["BREAK", "FAST", "FOOD", "CHAIN"],
      pairs: [
        { display: "BREAKFAST", hint: "The morning meal" },
        { display: "FAST FOOD", hint: "Quick-service restaurant food" },
        { display: "FOOD CHAIN", hint: "Ecosystem's eating order" },
      ],
    },
    {
      words: ["LONG", "BOW", "TIE", "BREAK"],
      pairs: [
        { display: "LONGBOW", hint: "A tall medieval archer's bow" },
        { display: "BOW TIE", hint: "A formal butterfly neck tie" },
        { display: "TIEBREAK", hint: "A deciding round in tennis" },
      ],
    },
    {
      words: ["KING", "JAMES", "BOND", "STREET"],
      pairs: [
        { display: "KING JAMES", hint: "The Bible's King James Version" },
        { display: "JAMES BOND", hint: "The fictional British spy, 007" },
        { display: "BOND STREET", hint: "Famous London shopping street" },
      ],
    },
    {
      words: ["GEORGE", "WASHINGTON", "STATE", "FAIR"],
      pairs: [
        { display: "GEORGE WASHINGTON", hint: "First US President" },
        { display: "WASHINGTON STATE", hint: "US state in the Pacific Northwest" },
        { display: "STATE FAIR", hint: "Annual agricultural exhibition" },
      ],
    },
    {
      words: ["ABRAHAM", "LINCOLN", "CENTER", "PIECE"],
      pairs: [
        { display: "ABRAHAM LINCOLN", hint: "16th US President" },
        { display: "LINCOLN CENTER", hint: "NYC performing arts complex" },
        { display: "CENTERPIECE", hint: "The main focal decoration on a table" },
      ],
    },
    {
      words: ["EYE", "BALL", "PARK", "WAY"],
      pairs: [
        { display: "EYEBALL", hint: "The organ of sight" },
        { display: "BALLPARK", hint: "Baseball stadium; also: a rough estimate" },
        { display: "PARKWAY", hint: "A scenic tree-lined road" },
      ],
    },
    {
      words: ["WATER", "FALL", "OUT", "BACK"],
      pairs: [
        { display: "WATERFALL", hint: "Water cascading over a cliff" },
        { display: "FALLOUT", hint: "Radioactive debris; side effects of an event" },
        { display: "OUTBACK", hint: "The remote interior of Australia" },
      ],
    },
    {
      words: ["BOOK", "SHELF", "LIFE", "GUARD"],
      pairs: [
        { display: "BOOKSHELF", hint: "A shelving unit for books" },
        { display: "SHELF LIFE", hint: "How long something stays fresh or usable" },
        { display: "LIFEGUARD", hint: "A trained swimmer who rescues others" },
      ],
    },
    {
      words: ["OVER", "BOARD", "GAME", "PLAN"],
      pairs: [
        { display: "OVERBOARD", hint: "Too extreme; or: falling off a ship" },
        { display: "BOARD GAME", hint: "A tabletop strategy game" },
        { display: "GAME PLAN", hint: "A strategy for success" },
      ],
    },
    {
      words: ["LONG", "JUMP", "SUIT", "CASE"],
      pairs: [
        { display: "LONG JUMP", hint: "Olympic track and field leaping event" },
        { display: "JUMPSUIT", hint: "A one-piece garment" },
        { display: "SUITCASE", hint: "A travel bag" },
      ],
    },
    {
      words: ["BOOK", "WORM", "WOOD", "PECKER"],
      pairs: [
        { display: "BOOKWORM", hint: "An enthusiastic reader" },
        { display: "WORMWOOD", hint: "A bitter herb; character in C.S. Lewis" },
        { display: "WOODPECKER", hint: "A bird that drills trees for insects" },
      ],
    },
  ],

  // ── Normal: 6 words, 4 mystery ───────────────────────────────────────────
  normal: [
    {
      words: ["FIRE", "WORKS", "SHOP", "LIFT", "OFF", "SIDE"],
      pairs: [
        { display: "FIREWORKS", hint: "Explosive celebration" },
        { display: "WORKSHOP", hint: "A craft or work space" },
        { display: "SHOPLIFT", hint: "Steal from a store" },
        { display: "LIFTOFF", hint: "Rocket launch moment" },
        { display: "OFFSIDE", hint: "Football or soccer rule violation" },
      ],
    },
    {
      words: ["OVER", "NIGHT", "STAND", "OFF", "SIDE", "WALK"],
      pairs: [
        { display: "OVERNIGHT", hint: "Through the night" },
        { display: "NIGHTSTAND", hint: "Bedside table" },
        { display: "STANDOFF", hint: "A deadlock" },
        { display: "OFFSIDE", hint: "Out of play" },
        { display: "SIDEWALK", hint: "A paved pedestrian path" },
      ],
    },
    {
      words: ["NEWS", "PAPER", "BACK", "BONE", "HEAD", "LINE"],
      pairs: [
        { display: "NEWSPAPER", hint: "Printed daily news" },
        { display: "PAPERBACK", hint: "Soft-cover book" },
        { display: "BACKBONE", hint: "Spine; also: courage" },
        { display: "BONEHEAD", hint: "A blockhead; a foolish person" },
        { display: "HEADLINE", hint: "Top story in a newspaper" },
      ],
    },
    {
      words: ["FLASH", "LIGHT", "HOUSE", "HOLD", "UP", "STAIRS"],
      pairs: [
        { display: "FLASHLIGHT", hint: "Battery-powered lamp" },
        { display: "LIGHTHOUSE", hint: "Nautical beacon tower" },
        { display: "HOUSEHOLD", hint: "A home's residents" },
        { display: "HOLDUP", hint: "A delay; also: an armed robbery" },
        { display: "UPSTAIRS", hint: "The floor above" },
      ],
    },
    {
      words: ["BLACK", "BIRD", "HOUSE", "WORK", "SHOP", "KEEPER"],
      pairs: [
        { display: "BLACKBIRD", hint: "A common songbird" },
        { display: "BIRDHOUSE", hint: "A wooden nesting box" },
        { display: "HOUSEWORK", hint: "Cleaning and household chores" },
        { display: "WORKSHOP", hint: "A studio or work space" },
        { display: "SHOPKEEPER", hint: "A store owner" },
      ],
    },
    {
      words: ["HAND", "SHAKE", "DOWN", "TOWN", "SHIP", "YARD"],
      pairs: [
        { display: "HANDSHAKE", hint: "A greeting" },
        { display: "SHAKEDOWN", hint: "An extortion" },
        { display: "DOWNTOWN", hint: "City center" },
        { display: "TOWNSHIP", hint: "A division of a county" },
        { display: "SHIPYARD", hint: "Where ships are built" },
      ],
    },
    {
      words: ["BREAK", "FAST", "FOOD", "CHAIN", "SAW", "MILL"],
      pairs: [
        { display: "BREAKFAST", hint: "Morning meal" },
        { display: "FAST FOOD", hint: "Quick-serve restaurant" },
        { display: "FOOD CHAIN", hint: "Ecological food hierarchy" },
        { display: "CHAINSAW", hint: "A motorized cutting saw" },
        { display: "SAWMILL", hint: "A lumber processing facility" },
      ],
    },
    {
      words: ["DAY", "DREAM", "LAND", "MARK", "DOWN", "TOWN"],
      pairs: [
        { display: "DAYDREAM", hint: "An idle waking fantasy" },
        { display: "DREAMLAND", hint: "An idyllic imaginary place" },
        { display: "LANDMARK", hint: "A notable location or milestone" },
        { display: "MARKDOWN", hint: "A price reduction" },
        { display: "DOWNTOWN", hint: "City center" },
      ],
    },
    {
      words: ["GOLD", "MINE", "FIELD", "WORK", "SHOP", "LIFT"],
      pairs: [
        { display: "GOLDMINE", hint: "An extremely profitable source" },
        { display: "MINEFIELD", hint: "Dangerous territory" },
        { display: "FIELDWORK", hint: "On-site research" },
        { display: "WORKSHOP", hint: "Creative work space" },
        { display: "SHOPLIFT", hint: "To steal from a store" },
      ],
    },
    {
      words: ["EYE", "BALL", "PARK", "WAY", "SIDE", "WALK"],
      pairs: [
        { display: "EYEBALL", hint: "The organ of sight" },
        { display: "BALLPARK", hint: "Baseball stadium; a rough estimate" },
        { display: "PARKWAY", hint: "A tree-lined road" },
        { display: "WAYSIDE", hint: "The edge of a road; fell by the wayside" },
        { display: "SIDEWALK", hint: "A paved footpath" },
      ],
    },
    {
      words: ["THUNDER", "STORM", "CLOUD", "BURST", "OUT", "RAGE"],
      pairs: [
        { display: "THUNDERSTORM", hint: "A storm with lightning" },
        { display: "STORM CLOUD", hint: "A heavy dark cloud" },
        { display: "CLOUDBURST", hint: "A sudden heavy rain" },
        { display: "BURST OUT", hint: "To suddenly erupt (burst out laughing)" },
        { display: "OUTRAGE", hint: "Extreme anger or shock" },
      ],
    },
    {
      words: ["CANDLE", "STICK", "UP", "TOWN", "SHIP", "YARD"],
      pairs: [
        { display: "CANDLESTICK", hint: "A candle holder" },
        { display: "STICKUP", hint: "A robbery at gunpoint" },
        { display: "UPTOWN", hint: "The upper or wealthier part of a city" },
        { display: "TOWNSHIP", hint: "A district division" },
        { display: "SHIPYARD", hint: "Where ships are built or repaired" },
      ],
    },
    {
      words: ["SUN", "FLOWER", "BED", "SIDE", "WALK", "OUT"],
      pairs: [
        { display: "SUNFLOWER", hint: "The tall yellow bloom" },
        { display: "FLOWERBED", hint: "A garden planting area" },
        { display: "BEDSIDE", hint: "Next to a bed" },
        { display: "SIDEWALK", hint: "A paved footpath" },
        { display: "WALKOUT", hint: "A protest; a sudden departure" },
      ],
    },
    {
      words: ["SPRING", "BOARD", "GAME", "PLAY", "GROUND", "WORK"],
      pairs: [
        { display: "SPRINGBOARD", hint: "A flexible diving board; a launching point" },
        { display: "BOARD GAME", hint: "A tabletop strategy game" },
        { display: "GAMEPLAY", hint: "How a game is played" },
        { display: "PLAYGROUND", hint: "Where children play" },
        { display: "GROUNDWORK", hint: "The foundation of a plan" },
      ],
    },
    {
      words: ["KEY", "BOARD", "WALK", "OUT", "RAGE", "QUIT"],
      pairs: [
        { display: "KEYBOARD", hint: "A typing input device" },
        { display: "BOARDWALK", hint: "A seaside wooden walkway" },
        { display: "WALKOUT", hint: "A protest or strike" },
        { display: "OUTRAGE", hint: "Extreme anger or shock" },
        { display: "RAGE QUIT", hint: "Abruptly quitting out of frustration" },
      ],
    },
    {
      words: ["FOOT", "NOTE", "BOOK", "MARK", "DOWN", "TOWN"],
      pairs: [
        { display: "FOOTNOTE", hint: "A page bottom reference" },
        { display: "NOTEBOOK", hint: "A writing journal" },
        { display: "BOOKMARK", hint: "A page-saving strip" },
        { display: "MARKDOWN", hint: "A price reduction" },
        { display: "DOWNTOWN", hint: "City center" },
      ],
    },
    {
      words: ["BOOK", "SHELF", "LIFE", "GUARD", "DOG", "FISH"],
      pairs: [
        { display: "BOOKSHELF", hint: "A unit for storing books" },
        { display: "SHELF LIFE", hint: "How long something stays usable" },
        { display: "LIFEGUARD", hint: "A poolside or beach rescuer" },
        { display: "GUARD DOG", hint: "A dog trained to protect" },
        { display: "DOGFISH", hint: "A small species of shark" },
      ],
    },
    {
      words: ["WATER", "FALL", "OUT", "DOOR", "BELL", "BOY"],
      pairs: [
        { display: "WATERFALL", hint: "Cascading water" },
        { display: "FALLOUT", hint: "Aftermath; radioactive debris" },
        { display: "OUTDOOR", hint: "Happening outside" },
        { display: "DOORBELL", hint: "An entrance chime" },
        { display: "BELLBOY", hint: "A hotel porter" },
      ],
    },
    {
      words: ["LONG", "JUMP", "SUIT", "CASE", "WORK", "SHOP"],
      pairs: [
        { display: "LONG JUMP", hint: "A leaping track and field event" },
        { display: "JUMPSUIT", hint: "A one-piece outfit" },
        { display: "SUITCASE", hint: "A travel bag" },
        { display: "CASEWORK", hint: "Social work with individual cases" },
        { display: "WORKSHOP", hint: "A creative work space" },
      ],
    },
    {
      words: ["BOOK", "MARK", "DOWN", "TOWN", "SHIP", "YARD"],
      pairs: [
        { display: "BOOKMARK", hint: "A reading place marker" },
        { display: "MARKDOWN", hint: "A price discount" },
        { display: "DOWNTOWN", hint: "City center" },
        { display: "TOWNSHIP", hint: "A local government area" },
        { display: "SHIPYARD", hint: "Where ships are built" },
      ],
    },
  ],

  // ── Long: 8 words, 6 mystery ─────────────────────────────────────────────
  long: [
    {
      words: ["FIRE", "WORKS", "SHOP", "LIFT", "OFF", "SIDE", "WALK", "OUT"],
      pairs: [
        { display: "FIREWORKS", hint: "Explosive celebration" },
        { display: "WORKSHOP", hint: "A craft or work space" },
        { display: "SHOPLIFT", hint: "Steal from a store" },
        { display: "LIFTOFF", hint: "Rocket launch moment" },
        { display: "OFFSIDE", hint: "Football rule violation" },
        { display: "SIDEWALK", hint: "A paved footpath" },
        { display: "WALKOUT", hint: "A protest; a sudden departure" },
      ],
    },
    {
      words: ["NEWS", "PAPER", "BACK", "BONE", "HEAD", "LINE", "UP", "STAIRS"],
      pairs: [
        { display: "NEWSPAPER", hint: "Printed daily news" },
        { display: "PAPERBACK", hint: "Soft-cover book" },
        { display: "BACKBONE", hint: "Spine; also: courage" },
        { display: "BONEHEAD", hint: "A blockhead" },
        { display: "HEADLINE", hint: "Top newspaper story" },
        { display: "LINEUP", hint: "Arranged sequence; a police lineup" },
        { display: "UPSTAIRS", hint: "The floor above" },
      ],
    },
    {
      words: ["BLACK", "BIRD", "HOUSE", "HOLD", "UP", "TOWN", "SHIP", "YARD"],
      pairs: [
        { display: "BLACKBIRD", hint: "A common songbird" },
        { display: "BIRDHOUSE", hint: "A wooden nesting box" },
        { display: "HOUSEHOLD", hint: "A home's residents" },
        { display: "HOLDUP", hint: "A delay; an armed robbery" },
        { display: "UPTOWN", hint: "The wealthier part of a city" },
        { display: "TOWNSHIP", hint: "A district division" },
        { display: "SHIPYARD", hint: "Where ships are built" },
      ],
    },
    {
      words: ["BREAK", "FAST", "FOOD", "CHAIN", "SAW", "MILL", "STONE", "WALL"],
      pairs: [
        { display: "BREAKFAST", hint: "Morning meal" },
        { display: "FAST FOOD", hint: "Quick-serve restaurant" },
        { display: "FOOD CHAIN", hint: "Ecological food hierarchy" },
        { display: "CHAINSAW", hint: "A motorized cutting saw" },
        { display: "SAWMILL", hint: "A lumber processing facility" },
        { display: "MILLSTONE", hint: "A heavy grinding stone; a burden" },
        { display: "STONEWALL", hint: "To obstruct or refuse to answer" },
      ],
    },
    {
      words: ["THUNDER", "STORM", "CLOUD", "BURST", "OUT", "DOOR", "BELL", "BOY"],
      pairs: [
        { display: "THUNDERSTORM", hint: "A storm with lightning" },
        { display: "STORM CLOUD", hint: "A heavy dark cloud" },
        { display: "CLOUDBURST", hint: "A sudden heavy rain" },
        { display: "BURST OUT", hint: "To suddenly erupt" },
        { display: "OUTDOOR", hint: "Happening outside" },
        { display: "DOORBELL", hint: "An entrance chime" },
        { display: "BELLBOY", hint: "A hotel porter" },
      ],
    },
    {
      words: ["OVER", "NIGHT", "STAND", "OFF", "SIDE", "WALK", "OUT", "RAGE"],
      pairs: [
        { display: "OVERNIGHT", hint: "Through the night" },
        { display: "NIGHTSTAND", hint: "Bedside table" },
        { display: "STANDOFF", hint: "A deadlock" },
        { display: "OFFSIDE", hint: "Out of play" },
        { display: "SIDEWALK", hint: "A paved footpath" },
        { display: "WALKOUT", hint: "A protest or strike" },
        { display: "OUTRAGE", hint: "Extreme anger or shock" },
      ],
    },
    {
      words: ["DAY", "DREAM", "LAND", "MARK", "DOWN", "TOWN", "SHIP", "YARD"],
      pairs: [
        { display: "DAYDREAM", hint: "An idle waking fantasy" },
        { display: "DREAMLAND", hint: "An idyllic imaginary place" },
        { display: "LANDMARK", hint: "A notable location or milestone" },
        { display: "MARKDOWN", hint: "A price reduction" },
        { display: "DOWNTOWN", hint: "City center" },
        { display: "TOWNSHIP", hint: "A district division" },
        { display: "SHIPYARD", hint: "Where ships are built" },
      ],
    },
    {
      words: ["CANDLE", "LIGHT", "HOUSE", "WORK", "SHOP", "LIFT", "OFF", "SIDE"],
      pairs: [
        { display: "CANDLELIGHT", hint: "Soft glow of a flame" },
        { display: "LIGHTHOUSE", hint: "A beacon guiding ships" },
        { display: "HOUSEWORK", hint: "Cleaning and household chores" },
        { display: "WORKSHOP", hint: "A studio or work space" },
        { display: "SHOPLIFT", hint: "To steal from a store" },
        { display: "LIFTOFF", hint: "Rocket launch moment" },
        { display: "OFFSIDE", hint: "Football rule violation" },
      ],
    },
    {
      words: ["SUN", "FLOWER", "BED", "SIDE", "WALK", "OUT", "DOOR", "STEP"],
      pairs: [
        { display: "SUNFLOWER", hint: "The tall yellow bloom" },
        { display: "FLOWERBED", hint: "A garden planting area" },
        { display: "BEDSIDE", hint: "Next to a bed" },
        { display: "SIDEWALK", hint: "A paved footpath" },
        { display: "WALKOUT", hint: "A protest; a sudden departure" },
        { display: "OUTDOOR", hint: "Happening outside" },
        { display: "DOORSTEP", hint: "The step at a front door" },
      ],
    },
    {
      words: ["SPRING", "BOARD", "GAME", "PLAY", "GROUND", "WORK", "SHOP", "KEEPER"],
      pairs: [
        { display: "SPRINGBOARD", hint: "A flexible diving board; a launching point" },
        { display: "BOARD GAME", hint: "A tabletop strategy game" },
        { display: "GAMEPLAY", hint: "How a game is played" },
        { display: "PLAYGROUND", hint: "Where children play" },
        { display: "GROUNDWORK", hint: "The foundation of a plan" },
        { display: "WORKSHOP", hint: "A studio or work space" },
        { display: "SHOPKEEPER", hint: "A store owner" },
      ],
    },
    {
      words: ["HAND", "SHAKE", "DOWN", "TOWN", "SHIP", "YARD", "ARM", "CHAIR"],
      pairs: [
        { display: "HANDSHAKE", hint: "A greeting" },
        { display: "SHAKEDOWN", hint: "An extortion" },
        { display: "DOWNTOWN", hint: "City center" },
        { display: "TOWNSHIP", hint: "A district division" },
        { display: "SHIPYARD", hint: "Where ships are built" },
        { display: "YARDARM", hint: "The outer end of a ship's yard (sailing term)" },
        { display: "ARMCHAIR", hint: "A comfortable chair with armrests" },
      ],
    },
    {
      words: ["BOOK", "SHELF", "LIFE", "GUARD", "DOG", "HOUSE", "HOLD", "UP"],
      pairs: [
        { display: "BOOKSHELF", hint: "A unit for storing books" },
        { display: "SHELF LIFE", hint: "How long something stays usable" },
        { display: "LIFEGUARD", hint: "A beach or pool rescuer" },
        { display: "GUARD DOG", hint: "A dog trained to protect" },
        { display: "DOGHOUSE", hint: "A dog's shelter; 'in the doghouse' = in trouble" },
        { display: "HOUSEHOLD", hint: "A home's residents" },
        { display: "HOLDUP", hint: "A delay; an armed robbery" },
      ],
    },
    {
      words: ["GOLD", "MINE", "FIELD", "GOAL", "POST", "MARK", "DOWN", "TOWN"],
      pairs: [
        { display: "GOLDMINE", hint: "An extremely profitable source" },
        { display: "MINEFIELD", hint: "Dangerous territory to navigate" },
        { display: "FIELD GOAL", hint: "A scoring kick in American football" },
        { display: "GOALPOST", hint: "The upright posts a kick must pass through" },
        { display: "POSTMARK", hint: "The ink stamp on a mailed letter" },
        { display: "MARKDOWN", hint: "A price reduction" },
        { display: "DOWNTOWN", hint: "City center" },
      ],
    },
    {
      words: ["WATER", "FALL", "OUT", "BACK", "BONE", "HEAD", "BAND", "STAND"],
      pairs: [
        { display: "WATERFALL", hint: "Water cascading over a cliff" },
        { display: "FALLOUT", hint: "Aftermath; radioactive debris" },
        { display: "OUTBACK", hint: "The remote interior of Australia" },
        { display: "BACKBONE", hint: "Spine; also: courage" },
        { display: "BONEHEAD", hint: "A blockhead" },
        { display: "HEADBAND", hint: "A band worn around the head" },
        { display: "BANDSTAND", hint: "An outdoor platform for musicians" },
      ],
    },
    {
      words: ["LONG", "BOW", "TIE", "BREAK", "DOWN", "TOWN", "SHIP", "YARD"],
      pairs: [
        { display: "LONGBOW", hint: "A tall medieval archer's bow" },
        { display: "BOW TIE", hint: "A formal butterfly neck tie" },
        { display: "TIEBREAK", hint: "A deciding round in tennis" },
        { display: "BREAKDOWN", hint: "A failure; an analysis; a nervous collapse" },
        { display: "DOWNTOWN", hint: "City center" },
        { display: "TOWNSHIP", hint: "A district division" },
        { display: "SHIPYARD", hint: "Where ships are built" },
      ],
    },
  ],
};
