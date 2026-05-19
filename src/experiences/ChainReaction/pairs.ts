export interface Pair {
  a: string;
  b: string;
  explanation: string;
}

// Each word that appears as `a` should have 3+ different `b` values.
// This ensures the bidirectional generator can always build chains of all lengths.
export const PAIRS: Pair[] = [
  // FIRE hub (→ WORKS, SIDE, PLACE, MAN, TRUCK, ALARM)
  { a: "FIRE", b: "WORKS",    explanation: "FIREWORKS — an explosive pyrotechnic display" },
  { a: "FIRE", b: "SIDE",     explanation: "FIRESIDE — the area beside a fireplace" },
  { a: "FIRE", b: "PLACE",    explanation: "FIREPLACE — a hearth built into a wall" },
  { a: "FIRE", b: "MAN",      explanation: "FIREMAN — a firefighter" },
  { a: "FIRE", b: "TRUCK",    explanation: "FIRE TRUCK — an emergency vehicle used to fight fires" },
  { a: "FIRE", b: "ALARM",    explanation: "FIRE ALARM — a device that warns of smoke or fire" },

  // WATER hub (→ FALL, PROOF, FRONT, MELON, MARK, WORKS)
  { a: "WATER", b: "FALL",    explanation: "WATERFALL — water flowing over a cliff" },
  { a: "WATER", b: "PROOF",   explanation: "WATERPROOF — impervious to water" },
  { a: "WATER", b: "FRONT",   explanation: "WATERFRONT — land bordering a body of water" },
  { a: "WATER", b: "MELON",   explanation: "WATERMELON — a large juicy summer fruit" },
  { a: "WATER", b: "MARK",    explanation: "WATERMARK — a faint design embedded in paper" },
  { a: "WATER", b: "WORKS",   explanation: "WATERWORKS — a system for supplying water to a city" },

  // BOOK hub (→ CASE, MARK, SHELF, WORM, STORE, END)
  { a: "BOOK", b: "CASE",     explanation: "BOOKCASE — a piece of furniture for storing books" },
  { a: "BOOK", b: "MARK",     explanation: "BOOKMARK — a strip used to mark a page" },
  { a: "BOOK", b: "SHELF",    explanation: "BOOKSHELF — a horizontal board for holding books" },
  { a: "BOOK", b: "WORM",     explanation: "BOOKWORM — a person who loves reading" },
  { a: "BOOK", b: "STORE",    explanation: "BOOKSTORE — a shop that sells books" },
  { a: "BOOK", b: "END",      explanation: "BOOKEND — a support placed at the end of a row of books" },

  // BACK hub (→ YARD, PACK, BONE, FIRE, GROUND, TRACK)
  { a: "BACK", b: "YARD",     explanation: "BACKYARD — the yard behind a house" },
  { a: "BACK", b: "PACK",     explanation: "BACKPACK — a bag carried on the back" },
  { a: "BACK", b: "BONE",     explanation: "BACKBONE — the spine; also: core strength" },
  { a: "BACK", b: "FIRE",     explanation: "BACKFIRE — to produce an unexpected bad result" },
  { a: "BACK", b: "GROUND",   explanation: "BACKGROUND — the area behind the main subject" },
  { a: "BACK", b: "TRACK",    explanation: "BACKTRACK — to retrace one's steps" },

  // HAND hub (→ MADE, SHAKE, BAG, BOOK, RAIL, STAND)
  { a: "HAND", b: "MADE",     explanation: "HANDMADE — crafted by hand, not machine" },
  { a: "HAND", b: "SHAKE",    explanation: "HANDSHAKE — a greeting or deal-sealing gesture" },
  { a: "HAND", b: "BAG",      explanation: "HANDBAG — a small bag carried by hand" },
  { a: "HAND", b: "BOOK",     explanation: "HANDBOOK — a concise reference manual" },
  { a: "HAND", b: "RAIL",     explanation: "HANDRAIL — a rail gripped for support on stairs" },
  { a: "HAND", b: "STAND",    explanation: "HANDSTAND — balancing upside down on one's hands" },

  // OVER hub (→ ALL, FLOW, LOOK, TIME, LOAD, PASS)
  { a: "OVER", b: "ALL",      explanation: "OVERALL — taking everything into account" },
  { a: "OVER", b: "FLOW",     explanation: "OVERFLOW — to spill over the top" },
  { a: "OVER", b: "LOOK",     explanation: "OVERLOOK — to fail to notice; also a scenic viewpoint" },
  { a: "OVER", b: "TIME",     explanation: "OVERTIME — time worked beyond normal hours" },
  { a: "OVER", b: "LOAD",     explanation: "OVERLOAD — to load with too much" },
  { a: "OVER", b: "PASS",     explanation: "OVERPASS — a bridge crossing over a road" },

  // BALL hub (→ PARK, ROOM, GAME, POINT, PLAYER, FIELD)
  { a: "BALL", b: "PARK",     explanation: "BALLPARK — a baseball stadium; also: approximate range" },
  { a: "BALL", b: "ROOM",     explanation: "BALLROOM — a large hall for formal dancing" },
  { a: "BALL", b: "GAME",     explanation: "BALL GAME — any sport played with a ball" },
  { a: "BALL", b: "POINT",    explanation: "BALLPOINT — a type of pen with a tiny rotating ball" },
  { a: "BALL", b: "PLAYER",   explanation: "BALL PLAYER — an athlete who plays a ball sport" },
  { a: "BALL", b: "FIELD",    explanation: "BALLFIELD — an area of ground used for ball sports" },

  // DAY hub (→ DREAM, LIGHT, BREAK, TIME, CARE, TRIP)
  { a: "DAY", b: "DREAM",     explanation: "DAYDREAM — a pleasant fantasy while awake" },
  { a: "DAY", b: "LIGHT",     explanation: "DAYLIGHT — the natural light of day" },
  { a: "DAY", b: "BREAK",     explanation: "DAYBREAK — the first light of day; dawn" },
  { a: "DAY", b: "TIME",      explanation: "DAYTIME — the hours between sunrise and sunset" },
  { a: "DAY", b: "CARE",      explanation: "DAYCARE — a facility that cares for children during the day" },
  { a: "DAY", b: "TRIP",      explanation: "DAY TRIP — an excursion completed in a single day" },

  // NIGHT hub (→ FALL, MARE, GOWN, CAP, CLUB, STAND)
  { a: "NIGHT", b: "FALL",    explanation: "NIGHTFALL — the onset of darkness in the evening" },
  { a: "NIGHT", b: "MARE",    explanation: "NIGHTMARE — a frightening dream" },
  { a: "NIGHT", b: "GOWN",    explanation: "NIGHTGOWN — a loose garment worn to bed" },
  { a: "NIGHT", b: "CAP",     explanation: "NIGHTCAP — a drink taken before bed; also a sleeping cap" },
  { a: "NIGHT", b: "CLUB",    explanation: "NIGHTCLUB — a venue for dancing and entertainment at night" },
  { a: "NIGHT", b: "STAND",   explanation: "NIGHTSTAND — a small bedside table" },

  // HOUSE hub (→ HOLD, WORK, PLANT, BOAT, WIFE, KEEPER)
  { a: "HOUSE", b: "HOLD",    explanation: "HOUSEHOLD — the people living together in a home" },
  { a: "HOUSE", b: "WORK",    explanation: "HOUSEWORK — cleaning and chores done at home" },
  { a: "HOUSE", b: "PLANT",   explanation: "HOUSEPLANT — a plant grown indoors" },
  { a: "HOUSE", b: "BOAT",    explanation: "HOUSEBOAT — a boat fitted out as a home" },
  { a: "HOUSE", b: "WIFE",    explanation: "HOUSEWIFE — a person who manages the home full time" },
  { a: "HOUSE", b: "KEEPER",  explanation: "HOUSEKEEPER — a person employed to manage a home" },

  // DOOR hub (→ STEP, BELL, KNOB, MAN, STOP, WAY)
  { a: "DOOR", b: "STEP",     explanation: "DOORSTEP — the step at the entrance of a building" },
  { a: "DOOR", b: "BELL",     explanation: "DOORBELL — a button that rings a bell to announce a visitor" },
  { a: "DOOR", b: "KNOB",     explanation: "DOORKNOB — the round handle used to open a door" },
  { a: "DOOR", b: "MAN",      explanation: "DOORMAN — a person who guards the entrance of a building" },
  { a: "DOOR", b: "STOP",     explanation: "DOORSTOP — a device to hold a door open" },
  { a: "DOOR", b: "WAY",      explanation: "DOORWAY — the opening of a door; an entrance" },

  // SUN hub (→ BURN, FLOWER, GLASSES, SET, SHINE, SCREEN)
  { a: "SUN", b: "BURN",      explanation: "SUNBURN — reddening of skin caused by UV rays" },
  { a: "SUN", b: "FLOWER",    explanation: "SUNFLOWER — a tall plant with a large yellow flower" },
  { a: "SUN", b: "GLASSES",   explanation: "SUNGLASSES — tinted lenses worn to shield eyes from sun" },
  { a: "SUN", b: "SET",       explanation: "SUNSET — the daily disappearance of the sun below the horizon" },
  { a: "SUN", b: "SHINE",     explanation: "SUNSHINE — direct sunlight unobstructed by cloud" },
  { a: "SUN", b: "SCREEN",    explanation: "SUNSCREEN — a lotion that protects skin from UV rays" },

  // FOOT hub (→ BALL, PRINT, STEP, NOTE, HOLD, PATH)
  { a: "FOOT", b: "BALL",     explanation: "FOOTBALL — a team sport played with an oval or round ball" },
  { a: "FOOT", b: "PRINT",    explanation: "FOOTPRINT — the mark left by a foot; also environmental impact" },
  { a: "FOOT", b: "STEP",     explanation: "FOOTSTEP — the sound or mark of a step" },
  { a: "FOOT", b: "NOTE",     explanation: "FOOTNOTE — a note at the bottom of a page" },
  { a: "FOOT", b: "HOLD",     explanation: "FOOTHOLD — a secure position from which to advance" },
  { a: "FOOT", b: "PATH",     explanation: "FOOTPATH — a path for pedestrians" },

  // LONG hub (→ JUMP, SHOT, BOW, HORN, BOAT, HOUSE)
  { a: "LONG", b: "JUMP",     explanation: "LONG JUMP — an athletic event jumping for distance" },
  { a: "LONG", b: "SHOT",     explanation: "LONG SHOT — an attempt unlikely to succeed" },
  { a: "LONG", b: "BOW",      explanation: "LONGBOW — a tall bow used in medieval archery" },
  { a: "LONG", b: "HORN",     explanation: "LONGHORN — a breed of cattle with long horns" },
  { a: "LONG", b: "BOAT",     explanation: "LONGBOAT — a long narrow boat used by Vikings" },
  { a: "LONG", b: "HOUSE",    explanation: "LONGHOUSE — a long communal dwelling" },

  // JUMP hub (→ ROPE, START, SHOT, SUIT, SEAT, BALL)
  { a: "JUMP", b: "ROPE",     explanation: "JUMP ROPE — a rope swung over the head for a skipping game" },
  { a: "JUMP", b: "START",    explanation: "JUMP-START — to start a car with another battery; boost something" },
  { a: "JUMP", b: "SHOT",     explanation: "JUMP SHOT — a basketball shot taken while jumping" },
  { a: "JUMP", b: "SUIT",     explanation: "JUMPSUIT — a one-piece garment covering the whole body" },
  { a: "JUMP", b: "SEAT",     explanation: "JUMP SEAT — a small folding seat in a vehicle" },

  // FAST hub (→ FOOD, BALL, TRACK, LANE, BREAK, PITCH)
  { a: "FAST", b: "FOOD",     explanation: "FAST FOOD — quickly prepared restaurant food" },
  { a: "FAST", b: "BALL",     explanation: "FASTBALL — a high-speed baseball pitch" },
  { a: "FAST", b: "TRACK",    explanation: "FAST TRACK — an accelerated route to a goal" },
  { a: "FAST", b: "LANE",     explanation: "FAST LANE — the overtaking lane on a highway" },
  { a: "FAST", b: "BREAK",    explanation: "FAST BREAK — a rapid offensive move in basketball" },
  { a: "FAST", b: "PITCH",    explanation: "FASTPITCH — a style of softball with fast underhand pitching" },

  // FOOD hub (→ COURT, CHAIN, BANK, STUFF, FIGHT, PRINT)
  { a: "FOOD", b: "COURT",    explanation: "FOOD COURT — a shopping center area with multiple food vendors" },
  { a: "FOOD", b: "CHAIN",    explanation: "FOOD CHAIN — the sequence of who eats whom in nature" },
  { a: "FOOD", b: "BANK",     explanation: "FOOD BANK — a charity that collects and distributes food" },
  { a: "FOOD", b: "STUFF",    explanation: "FOODSTUFF — a substance used as food" },
  { a: "FOOD", b: "FIGHT",    explanation: "FOOD FIGHT — a playful battle using food as projectiles" },

  // KING hub (→ JAMES, COBRA, FISHER, SIZE, DOME, PIN)
  { a: "KING", b: "JAMES",    explanation: "KING JAMES — King James I of England; also the KJV Bible" },
  { a: "KING", b: "COBRA",    explanation: "KING COBRA — the world's longest venomous snake" },
  { a: "KING", b: "FISHER",   explanation: "KINGFISHER — a brightly colored bird that dives for fish" },
  { a: "KING", b: "SIZE",     explanation: "KING-SIZE — the largest standard bed size" },
  { a: "KING", b: "DOME",     explanation: "KINGDOM — a country ruled by a king or queen" },
  { a: "KING", b: "PIN",      explanation: "KINGPIN — the central or most important person in a group" },

  // SNOW hub (→ BALL, FLAKE, STORM, FALL, MAN, BOARD)
  { a: "SNOW", b: "BALL",     explanation: "SNOWBALL — a ball of packed snow; also: to grow rapidly" },
  { a: "SNOW", b: "FLAKE",    explanation: "SNOWFLAKE — a single crystal of snow" },
  { a: "SNOW", b: "STORM",    explanation: "SNOWSTORM — a heavy fall of snow with strong wind" },
  { a: "SNOW", b: "FALL",     explanation: "SNOWFALL — the amount of snow that falls" },
  { a: "SNOW", b: "MAN",      explanation: "SNOWMAN — a figure built from packed snow" },
  { a: "SNOW", b: "BOARD",    explanation: "SNOWBOARD — a board for sliding down snowy slopes" },

  // GOLD hub (→ FISH, MINE, RUSH, SMITH, FIELD, FINGER)
  { a: "GOLD", b: "FISH",     explanation: "GOLDFISH — a small orange fish kept as a pet" },
  { a: "GOLD", b: "MINE",     explanation: "GOLD MINE — a mine that produces gold; a rich source" },
  { a: "GOLD", b: "RUSH",     explanation: "GOLD RUSH — a migration to a region where gold is found" },
  { a: "GOLD", b: "SMITH",    explanation: "GOLDSMITH — a craftsman who makes gold objects" },
  { a: "GOLD", b: "FIELD",    explanation: "GOLDFIELD — an area rich in gold deposits" },
  { a: "GOLD", b: "FINGER",   explanation: "GOLDFINGER — a James Bond villain; also: a gold-stained finger" },

  // ROAD hub (→ BLOCK, SIDE, TRIP, RUNNER, WORK, SHOW)
  { a: "ROAD", b: "BLOCK",    explanation: "ROADBLOCK — an obstacle blocking a road; a barrier to progress" },
  { a: "ROAD", b: "SIDE",     explanation: "ROADSIDE — the strip of land along the side of a road" },
  { a: "ROAD", b: "TRIP",     explanation: "ROAD TRIP — a long journey made by car" },
  { a: "ROAD", b: "RUNNER",   explanation: "ROADRUNNER — a fast-running ground bird; also a cartoon character" },
  { a: "ROAD", b: "WORK",     explanation: "ROADWORK — construction or repairs done on a road" },
  { a: "ROAD", b: "SHOW",     explanation: "ROADSHOW — a traveling promotional tour or exhibition" },

  // HEAD hub (→ BAND, LIGHT, QUARTER, STRONG, BAND, LINE)
  { a: "HEAD", b: "BAND",     explanation: "HEADBAND — a band worn around the head" },
  { a: "HEAD", b: "LIGHT",    explanation: "HEADLIGHT — a powerful light on the front of a vehicle" },
  { a: "HEAD", b: "QUARTER",  explanation: "HEADQUARTERS — the main offices of an organization" },
  { a: "HEAD", b: "STRONG",   explanation: "HEADSTRONG — stubbornly determined to have one's own way" },
  { a: "HEAD", b: "LINE",     explanation: "HEADLINE — the title of a newspaper story" },
  { a: "HEAD", b: "STONE",    explanation: "HEADSTONE — a stone placed at the head of a grave" },

  // WIND hub (→ MILL, SHIELD, PIPE, FALL, STORM, BREAKER)
  { a: "WIND", b: "MILL",     explanation: "WINDMILL — a mill powered by rotating wind-driven vanes" },
  { a: "WIND", b: "SHIELD",   explanation: "WINDSHIELD — the front window of a vehicle" },
  { a: "WIND", b: "PIPE",     explanation: "WINDPIPE — the trachea; the airway to the lungs" },
  { a: "WIND", b: "FALL",     explanation: "WINDFALL — an unexpected piece of good fortune, esp. money" },
  { a: "WIND", b: "STORM",    explanation: "WINDSTORM — a storm with very strong wind but little rain" },
  { a: "WIND", b: "BREAKER",  explanation: "WINDBREAKER — a light jacket that blocks the wind" },

  // STONE hub (→ WALL, FISH, COLD, MASON, WORK, CUTTER)
  { a: "STONE", b: "WALL",    explanation: "STONEWALL — to obstruct or delay by refusing to answer" },
  { a: "STONE", b: "FISH",    explanation: "STONEFISH — the world's most venomous fish, camouflaged as rock" },
  { a: "STONE", b: "COLD",    explanation: "STONE COLD — completely cold; Steve Austin's nickname" },
  { a: "STONE", b: "MASON",   explanation: "STONEMASON — a craftsman who works with stone" },
  { a: "STONE", b: "WORK",    explanation: "STONEWORK — masonry made from stone" },
  { a: "STONE", b: "CUTTER",  explanation: "STONECUTTER — a person or machine that cuts stone" },

  // LIGHT hub (→ HOUSE, WEIGHT, YEAR, NING, BULB, BEAM)
  { a: "LIGHT", b: "HOUSE",   explanation: "LIGHTHOUSE — a tower with a beacon light to guide ships" },
  { a: "LIGHT", b: "WEIGHT",  explanation: "LIGHTWEIGHT — low in weight; a boxing weight class" },
  { a: "LIGHT", b: "YEAR",    explanation: "LIGHT-YEAR — the distance light travels in one year" },
  { a: "LIGHT", b: "NING",    explanation: "LIGHTNING — an electrical discharge in the atmosphere" },
  { a: "LIGHT", b: "BULB",    explanation: "LIGHT BULB — a glass bulb that produces electric light" },
  { a: "LIGHT", b: "BEAM",    explanation: "LIGHT BEAM — a ray or column of light" },

  // RAIN hub (→ BOW, DROP, COAT, FALL, FOREST, STORM)
  { a: "RAIN", b: "BOW",      explanation: "RAINBOW — an arc of colors formed by sunlight through rain" },
  { a: "RAIN", b: "DROP",     explanation: "RAINDROP — a single drop of rain" },
  { a: "RAIN", b: "COAT",     explanation: "RAINCOAT — a waterproof coat worn in the rain" },
  { a: "RAIN", b: "FALL",     explanation: "RAINFALL — the amount of rain that falls in an area" },
  { a: "RAIN", b: "FOREST",   explanation: "RAINFOREST — a dense forest with very high annual rainfall" },
  { a: "RAIN", b: "STORM",    explanation: "RAINSTORM — a storm with heavy rain" },

  // CROSS hub (→ WORD, ROAD, WALK, BOW, COUNTRY, FIRE)
  { a: "CROSS", b: "WORD",    explanation: "CROSSWORD — a word puzzle arranged in a grid" },
  { a: "CROSS", b: "ROAD",    explanation: "CROSSROAD — a point where two roads intersect; a decision point" },
  { a: "CROSS", b: "WALK",    explanation: "CROSSWALK — a marked path for pedestrians to cross a road" },
  { a: "CROSS", b: "BOW",     explanation: "CROSSBOW — a bow mounted on a stock that shoots bolts" },
  { a: "CROSS", b: "COUNTRY", explanation: "CROSS-COUNTRY — traveling across open terrain or a nation" },
  { a: "CROSS", b: "FIRE",    explanation: "CROSSFIRE — gunfire from opposing sides; caught in between" },

  // SEA hub (→ SHORE, FOOD, SHELL, GULL, HORSE, WEED)
  { a: "SEA", b: "SHORE",     explanation: "SEASHORE — the land along the edge of the sea" },
  { a: "SEA", b: "FOOD",      explanation: "SEAFOOD — fish and shellfish eaten as food" },
  { a: "SEA", b: "SHELL",     explanation: "SEASHELL — the shell of a marine creature" },
  { a: "SEA", b: "GULL",      explanation: "SEAGULL — a common coastal bird" },
  { a: "SEA", b: "HORSE",     explanation: "SEAHORSE — a small fish with a horse-like head" },
  { a: "SEA", b: "WEED",      explanation: "SEAWEED — marine algae that grows in the ocean" },

  // NET hub (→ WORK, BALL, BOOK, FLIX, SUIT, CAST)
  { a: "NET", b: "WORK",      explanation: "NETWORK — a system of connected people or things" },
  { a: "NET", b: "BALL",      explanation: "NETBALL — a team sport similar to basketball" },
  { a: "NET", b: "BOOK",      explanation: "NOTEBOOK — a book of blank pages for writing notes" },
  { a: "NET", b: "FLIX",      explanation: "NETFLIX — a popular streaming entertainment service" },
  { a: "NET", b: "SUIT",      explanation: "NETSUIT — a full-body protective suit with mesh or net material" },
  { a: "NET", b: "CAST",      explanation: "NETCAST — a broadcast transmitted over the internet" },

  // EARTH hub (→ QUAKE, WORM, WORK, WORM, BOUND, LING)
  { a: "EARTH", b: "QUAKE",   explanation: "EARTHQUAKE — a sudden shaking of the ground" },
  { a: "EARTH", b: "WORM",    explanation: "EARTHWORM — a burrowing worm found in soil" },
  { a: "EARTH", b: "WORK",    explanation: "EARTHWORK — a fortification or embankment made of earth" },
  { a: "EARTH", b: "BOUND",   explanation: "EARTHBOUND — heading toward Earth; confined to Earth" },
  { a: "EARTH", b: "LING",    explanation: "EARTHLING — an inhabitant of Earth" },

  // GREEN hub (→ HOUSE, BACK, LAND, PEACE, CARD, ROOM)
  { a: "GREEN", b: "HOUSE",   explanation: "GREENHOUSE — a glass building for growing plants year-round" },
  { a: "GREEN", b: "BACK",    explanation: "GREENBACK — a US dollar bill" },
  { a: "GREEN", b: "LAND",    explanation: "GREENLAND — the world's largest island; an Arctic territory" },
  { a: "GREEN", b: "PEACE",   explanation: "GREENPEACE — an international environmental organization" },
  { a: "GREEN", b: "CARD",    explanation: "GREEN CARD — a US permanent resident permit" },
  { a: "GREEN", b: "ROOM",    explanation: "GREEN ROOM — a backstage room where performers wait" },

  // STAR hub (→ FISH, LIGHT, GAZE, BOARD, SHIP, WARS)
  { a: "STAR", b: "FISH",     explanation: "STARFISH — a marine animal with a star-shaped body" },
  { a: "STAR", b: "LIGHT",    explanation: "STARLIGHT — the light that reaches us from stars" },
  { a: "STAR", b: "GAZE",     explanation: "STARGAZE — to observe the stars; to dream idly" },
  { a: "STAR", b: "BOARD",    explanation: "STARBOARD — the right side of a ship or aircraft" },
  { a: "STAR", b: "SHIP",     explanation: "STARSHIP — a large spacecraft designed for interstellar travel" },
  { a: "STAR", b: "WARS",     explanation: "STAR WARS — a legendary sci-fi film franchise by George Lucas" },

  // SPACE hub (→ SHIP, CRAFT, WALK, SUIT, PORT, BAR)
  { a: "SPACE", b: "SHIP",    explanation: "SPACESHIP — a vehicle for traveling in outer space" },
  { a: "SPACE", b: "CRAFT",   explanation: "SPACECRAFT — a vehicle designed to travel in space" },
  { a: "SPACE", b: "WALK",    explanation: "SPACEWALK — an excursion outside a spacecraft in space" },
  { a: "SPACE", b: "SUIT",    explanation: "SPACESUIT — a pressurized suit worn by astronauts" },
  { a: "SPACE", b: "PORT",    explanation: "SPACEPORT — a site for launching and receiving spacecraft" },
  { a: "SPACE", b: "BAR",     explanation: "SPACE BAR — the wide key at the bottom of a keyboard" },

  // UNDER hub (→ GROUND, WATER, WEAR, COVER, WORLD, SCORE)
  { a: "UNDER", b: "GROUND",  explanation: "UNDERGROUND — below the surface; also a secret movement" },
  { a: "UNDER", b: "WATER",   explanation: "UNDERWATER — below the surface of water" },
  { a: "UNDER", b: "WEAR",    explanation: "UNDERWEAR — clothing worn next to the skin under other clothes" },
  { a: "UNDER", b: "COVER",   explanation: "UNDERCOVER — working secretly; a covert agent" },
  { a: "UNDER", b: "WORLD",   explanation: "UNDERWORLD — the world of crime; mythological realm of the dead" },
  { a: "UNDER", b: "SCORE",   explanation: "UNDERSCORE — to emphasize; also the _ character" },

  // DRAGON hub (→ FLY, FRUIT, BOAT, HEART, TAIL, FIRE)
  { a: "DRAGON", b: "FLY",    explanation: "DRAGONFLY — a fast-flying insect with large compound eyes" },
  { a: "DRAGON", b: "FRUIT",  explanation: "DRAGONFRUIT — a tropical fruit with a spiky pink exterior" },
  { a: "DRAGON", b: "BOAT",   explanation: "DRAGON BOAT — a long canoe with a dragon head used in races" },
  { a: "DRAGON", b: "HEART",  explanation: "DRAGONHEART — a 1996 fantasy film about a dragon and a knight" },
  { a: "DRAGON", b: "TAIL",   explanation: "DRAGONTAIL — the tail of a dragon; also a type of butterfly" },

  // THUNDER hub (→ BOLT, STORM, BIRD, STRUCK, CLAP)
  { a: "THUNDER", b: "BOLT",  explanation: "THUNDERBOLT — a lightning flash; Zeus's weapon" },
  { a: "THUNDER", b: "STORM", explanation: "THUNDERSTORM — a storm with thunder and lightning" },
  { a: "THUNDER", b: "BIRD",  explanation: "THUNDERBIRD — a mythical indigenous North American bird" },
  { a: "THUNDER", b: "STRUCK", explanation: "THUNDERSTRUCK — extremely surprised or shocked" },
  { a: "THUNDER", b: "CLAP",  explanation: "THUNDERCLAP — a single loud crash of thunder" },

  // BRAIN hub (→ STORM, WASH, POWER, WAVE, CHILD, DEAD)
  { a: "BRAIN", b: "STORM",   explanation: "BRAINSTORM — to spontaneously generate creative ideas as a group" },
  { a: "BRAIN", b: "WASH",    explanation: "BRAINWASH — to cause someone to adopt radically different beliefs" },
  { a: "BRAIN", b: "POWER",   explanation: "BRAINPOWER — intellectual ability; mental capacity" },
  { a: "BRAIN", b: "WAVE",    explanation: "BRAINWAVE — an electrical signal in the brain; a sudden insight" },
  { a: "BRAIN", b: "CHILD",   explanation: "BRAINCHILD — a plan or invention originated by a person" },
  { a: "BRAIN", b: "DEAD",    explanation: "BRAIN-DEAD — showing no brain activity; also: stupidly unthinking" },

  // HEART hub (→ BEAT, BREAK, LAND, THROB, BURN, FELT)
  { a: "HEART", b: "BEAT",    explanation: "HEARTBEAT — the rhythmic contraction of the heart" },
  { a: "HEART", b: "BREAK",   explanation: "HEARTBREAK — overwhelming grief or sorrow" },
  { a: "HEART", b: "LAND",    explanation: "HEARTLAND — the central region of a country" },
  { a: "HEART", b: "THROB",   explanation: "HEARTTHROB — a celebrity considered very attractive" },
  { a: "HEART", b: "BURN",    explanation: "HEARTBURN — a burning sensation in the chest from acid reflux" },
  { a: "HEART", b: "FELT",    explanation: "HEARTFELT — deeply and sincerely felt" },

  // BOOK–MARK crossover (MARK hub → DOWN, UP, SMITH, ET, MAN, ABLE)
  { a: "MARK", b: "DOWN",     explanation: "MARKDOWN — a reduction in price; also a text formatting language" },
  { a: "MARK", b: "UP",       explanation: "MARKUP — an increase in price; also HTML/CSS code" },
  { a: "MARK", b: "SMITH",    explanation: "MARKSMITH — an expert marksman; skilled with a gun" },
  { a: "MARK", b: "ET",       explanation: "MARKET — a place for buying and selling goods" },
  { a: "MARK", b: "MAN",      explanation: "MARKSMAN — a person skilled in shooting at a target" },
  { a: "MARK", b: "ABLE",     explanation: "REMARKABLE — worthy of notice; extraordinary" },

  // GROUND hub (→ WORK, BREAK, HOG, KEEPER, SWELL, WATER)
  { a: "GROUND", b: "WORK",   explanation: "GROUNDWORK — preparatory work that forms the foundation" },
  { a: "GROUND", b: "BREAK",  explanation: "GROUNDBREAKING — revolutionary; also the ceremony for new construction" },
  { a: "GROUND", b: "HOG",    explanation: "GROUNDHOG — a large ground squirrel; famous for Groundhog Day" },
  { a: "GROUND", b: "KEEPER", explanation: "GROUNDKEEPER — a person who maintains a sports field or estate" },
  { a: "GROUND", b: "SWELL",  explanation: "GROUNDSWELL — a build-up of opinion or feeling; ocean waves from afar" },
  { a: "GROUND", b: "WATER",  explanation: "GROUNDWATER — water found underground in aquifers" },

  // Standalone pairs that extend common words
  { a: "EYE", b: "BALL",      explanation: "EYEBALL — the spherical organ of sight" },
  { a: "EYE", b: "BROW",      explanation: "EYEBROW — the strip of hair above the eye" },
  { a: "EYE", b: "LASH",      explanation: "EYELASH — a hair growing on the edge of the eyelid" },
  { a: "EYE", b: "LID",       explanation: "EYELID — the fold of skin that covers the eye" },
  { a: "EYE", b: "SIGHT",     explanation: "EYESIGHT — the ability to see; vision" },
  { a: "EYE", b: "WITNESS",   explanation: "EYEWITNESS — a person who sees an event happen" },

  { a: "HAIR", b: "CUT",      explanation: "HAIRCUT — the act of cutting hair; the style it's cut in" },
  { a: "HAIR", b: "DO",       explanation: "HAIRDO — a hairstyle" },
  { a: "HAIR", b: "LINE",     explanation: "HAIRLINE — the edge of hair growth on the forehead" },
  { a: "HAIR", b: "PIN",      explanation: "HAIRPIN — a U-shaped pin for fastening hair; a sharp bend" },
  { a: "HAIR", b: "PIECE",    explanation: "HAIRPIECE — a section of false hair; a wig" },
  { a: "HAIR", b: "BRUSH",    explanation: "HAIRBRUSH — a brush used to groom hair" },

  { a: "ARM", b: "CHAIR",     explanation: "ARMCHAIR — a chair with armrests" },
  { a: "ARM", b: "PIT",       explanation: "ARMPIT — the hollow under the arm at the shoulder" },
  { a: "ARM", b: "BAND",      explanation: "ARMBAND — a band worn around the arm" },
  { a: "ARM", b: "HOLE",      explanation: "ARMHOLE — an opening in a garment for the arm" },
  { a: "ARM", b: "REST",      explanation: "ARMREST — a support for the arm on a chair or vehicle" },

  { a: "LAND", b: "MARK",     explanation: "LANDMARK — a prominent or recognizable feature of the landscape" },
  { a: "LAND", b: "SLIDE",    explanation: "LANDSLIDE — a mass of rock/earth falling; an overwhelming win" },
  { a: "LAND", b: "LORD",     explanation: "LANDLORD — a person who rents out property" },
  { a: "LAND", b: "LINE",     explanation: "LANDLINE — a telephone line that runs through physical cables" },
  { a: "LAND", b: "FILL",     explanation: "LANDFILL — a site for disposing of waste by burying it" },
  { a: "LAND", b: "SCAPE",    explanation: "LANDSCAPE — the visible features of an area of land" },

  { a: "SHOP", b: "KEEPER",   explanation: "SHOPKEEPER — a person who owns or runs a shop" },
  { a: "SHOP", b: "LIFT",     explanation: "SHOPLIFT — to steal goods from a shop" },
  { a: "SHOP", b: "PING",     explanation: "SHOPPING — the action of buying goods" },
  { a: "SHOP", b: "FLOOR",    explanation: "SHOP FLOOR — the area of a factory where production happens" },
  { a: "SHOP", b: "FRONT",    explanation: "SHOPFRONT — the facade of a shop" },
  { a: "SHOP", b: "WORN",     explanation: "SHOPWORN — slightly damaged from being on display in a shop" },

  { a: "TIME", b: "TABLE",    explanation: "TIMETABLE — a schedule of planned times for events" },
  { a: "TIME", b: "LINE",     explanation: "TIMELINE — a graphic showing events in chronological order" },
  { a: "TIME", b: "OUT",      explanation: "TIMEOUT — a short break from play; a pause for a child's discipline" },
  { a: "TIME", b: "KEEPER",   explanation: "TIMEKEEPER — a person or device that measures time" },
  { a: "TIME", b: "PIECE",    explanation: "TIMEPIECE — a clock or watch" },
  { a: "TIME", b: "FRAME",    explanation: "TIME FRAME — a period of time within which something occurs" },

  { a: "KEY", b: "BOARD",     explanation: "KEYBOARD — a panel of keys for a computer or musical instrument" },
  { a: "KEY", b: "STONE",     explanation: "KEYSTONE — the central stone of an arch; an essential element" },
  { a: "KEY", b: "NOTE",      explanation: "KEYNOTE — the most important note; the central theme of an event" },
  { a: "KEY", b: "CHAIN",     explanation: "KEYCHAIN — a small chain for holding keys" },
  { a: "KEY", b: "WORD",      explanation: "KEYWORD — a word used as a key to a code; a search term" },
  { a: "KEY", b: "HOLE",      explanation: "KEYHOLE — the hole in a lock for inserting a key" },
];
