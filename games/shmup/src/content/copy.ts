/**
 * The flat copy table — every short player-facing string that doesn't need
 * its own structured shape (those live in ratings.ts, brands.ts,
 * crowdComments.ts instead). Keys are dotted strings grouped by namespace
 * below; add new keys in the matching section rather than inventing a new
 * one. See ./README.md for the full authoring guide.
 */
export const COPY = {
  // ---- Title / intro ----
  "game.title": "SHMUP",
  "intro.presents": "Noahsoft presents:",
  "intro.sticker": "Works on Doors 97!",

  // ---- Main menu / app flow (run-structure app-flow, S3 #173) ----
  "menu.newCareer": "NEW CAREER",
  "menu.continue": "CONTINUE",
  "menu.continue.disabled": "CONTINUE (NO SAVE)",
  "menu.settings": "SETTINGS",
  "menu.hallOfFame": "HALL OF FAME",
  "menu.hint": "Arrows or Tap to select · Enter/Tap to confirm",
  "menu.stub.comingSoon": "Coming soon.",
  "menu.stub.back": "PRESS ANY KEY OR TAP TO GO BACK",

  // ---- Season / Finale / Syndication flavor (run-structure.spec.todo.md) ----
  "season.finale.title": "SEASON FINALE",
  "season.finale.flavor": "The network's watching. Don't blow it.",
  "series.finale.title": "SERIES FINALE",
  "series.finale.flavor": "Five seasons. One shot at legend status.",
  "syndication.title": "SYNDICATION",
  "syndication.flavor": "The show goes on. Forever, if you're good enough.",
  "cancelled.title": "CANCELLED",
  "cancelled.flavor": "The execs pulled the plug, {playerName}. Better luck next career.",

  // ---- Event nodes (run-structure.spec.todo.md node types) ----
  "node.standard.flavor": "Another contract. Another paycheck.",
  "node.elite.flavor": "Somebody important is watching this one.",
  "node.shop.flavor": "The pit crew's got a deal for you.",
  "node.event.flavor": "Something's not on the call sheet.",
  "node.treasure.flavor": "Craft services left the good stuff out.",
  "node.bossFinale.flavor": "This is the one the trailer's built around.",

  // ---- Weapon/item/chassis/enemy copy ----
  // Convention: "weapon.<id>.name" / "weapon.<id>.description", and the
  // same shape for "item.", "chassis.", "enemy.". F3/F4 own the systems
  // that assign real ids; these two are placeholders proving the shape.
  "weapon.placeholder.name": "Stock Blaster",
  "weapon.placeholder.description": "Standard-issue. Gets the job done.",
  "weapon.twin-blaster.name": "Twin Blaster",
  "weapon.twin-blaster.description": "Two barrels, double the rate of fire.",
  "weapon.grease-gun.name": "Grease Gun",
  "weapon.grease-gun.description": "Sponsored slug-thrower. Punches through ground targets.",
  "enemy.placeholder.name": "Drone",
  "enemy.placeholder.description": "Cheap, expendable, everywhere.",

  // ---- Chassis (chassis.spec.md, F10 #138 / C7 #146) ----
  "chassis.default.name": "Roadrunner Mk. I",
  "chassis.default.description": "No frills, no gimmicks. A balanced stock frame.",
  "chassis.ikaruga.name": "Chromashift Mk. I",
  "chassis.ikaruga.description": "Switch polarity to absorb same-color fire into Hype. Wrong-color shots bounce off enemies harmlessly.",

  // ---- Passive items (items-and-brands.spec.todo.md, F9 #137) ----
  "item.lucky-rabbits-foot.name": "Lucky Rabbit's Foot",
  "item.piggy-bank.name": "Piggy Bank",
  "item.adrenal-gland.name": "Adrenal Gland",
  "item.slick-treads.name": "Slick Treads",
  "item.nitro-boost.name": "Nitro Boost",
  "item.bruise-cream.name": "Bruise Cream",
  "item.pain-tolerance.name": "Pain Tolerance",
  "item.steel-plating.name": "Steel Plating",
  "item.magnet-coil.name": "Magnet Coil",
  "item.greased-bearings.name": "Greased Bearings",
  "item.adrenaline-rush.name": "Adrenaline Rush",
  "item.four-leaf-clover.name": "Four-Leaf Clover",
  "item.full-synthetic.name": "Full Synthetic",
  "item.glutton-for-punishment.name": "Glutton for Punishment",
  "item.golden-ticket.name": "Golden Ticket",

  // ---- Core gameplay loop HUD/flow (F6 #134) ----
  "play.score": "SCORE {score}",
  "play.hint": "Drag/Arrows/WASD to move · Hold Shift to Focus · auto-fire",
  "play.episodeOver.title": "EPISODE OVER",
  "play.episodeOver.score": "Final Score: {score}",
  "play.episodeOver.restartPrompt": "PRESS ANY KEY OR TAP TO TRY AGAIN",

  // ---- Hype / Ratings HUD/flow (hype-and-ratings.spec.md, F7 #135) ----
  "play.ratings": "RATINGS {ratings} · {tier}",
  "play.episodeClear.title": "EPISODE CLEAR",
  "play.episodeClear.score": "Final Score: {score}",
  "play.episodeClear.ratingsGain": "+{ratings} Ratings",
  "play.episodeOver.ratingsLoss": "-{ratings} Ratings",
  "play.continuePrompt": "PRESS ANY KEY OR TAP TO CONTINUE",

  // ---- Resolve screen / episode -> map flow (run-structure.spec.todo.md, F8 #136) ----
  "resolve.ratingsLine": "RATINGS {ratings} · {tier}",
  "resolve.finaleScore": "Finale Score: {score}",
  "resolve.syndicationScore": "Syndication Score: {score}",
  "resolve.goldCollected": "+{gold}g collected",
  "resolve.levelUp": "LEVEL UP x{count}",
  "cancelled.restartPrompt": "PRESS ANY KEY OR TAP TO RETURN TO THE MENU",

  // ---- Season node-map (run-structure.spec.todo.md, F8 #136) ----
  "map.title": "SEASON {season}",
  "map.hint": "Tap a node to fly the episode",
  "map.deadlineWarning": "THE DEADLINE IS CLOSING IN",
  "map.syndication.title": "SYNDICATION",
  "map.syndication.episode": "Episode {episode}",
  "map.syndication.hint": "Tap to fly the next episode",
  "map.node.standard": "CONTRACT",
  "map.node.elite": "ELITE",
  "map.node.shop": "PIT STOP",
  "map.node.event": "EVENT",
  "map.node.treasure": "CRAFT SERVICES",
  "map.node.bossFinale": "SEASON FINALE",
  "map.node.seriesFinale": "SERIES FINALE",
  "map.node.fogged": "?",
  "map.node.here": "HERE",
  "map.newCareer": "NEW CAREER",
  "map.newCareer.confirm": "TAP AGAIN TO CONFIRM",
  "map.desynced.title": "MAP ERROR",
  "map.desynced.flavor": "No reachable episodes from here. Start a new career to keep playing.",
  "map.hangar": "HANGAR",

  // ---- Hangar / chassis selection (chassis.spec.md, F10 #138 / C7 #146) ----
  "hangar.title": "HANGAR",
  "hangar.hint": "Tap a chassis to equip it",
  "hangar.equipped": "EQUIPPED",
  "hangar.back": "BACK TO MAP",

  // ---- Level-up (economy.spec.todo.md, F9 #137): end-of-level break only, batched, never mid-play ----
  "levelup.title": "LEVEL UP!",
  "levelup.pickPrompt": "Pick {current} of {total}",

  // ---- Reroll (economy.spec.todo.md, F9 #137): shared copy — level-up picks and shop visits both spend the same escalating-cost reroll. ----
  "reroll.cost": "🎲 REROLL ({cost}g)",
  "reroll.free": "🎲 REROLL (FREE)",
  "reroll.cantAfford": "Not enough gold to reroll",

  // ---- Shop (economy.spec.todo.md, F9 #137): baseline break shop + dedicated map shop nodes ----
  "shop.title.baseline": "PIT STOP",
  "shop.title.node": "THE GARAGE",
  "shop.gold": "GOLD {gold}",
  "shop.interestEarned": "+{gold}g interest",
  "shop.buy": "BUY ({cost}g)",
  "shop.upgrade": "UPGRADE ({cost}g)",
  "shop.slotsFull": "SLOTS FULL",
  "shop.atCap": "MAXED",
  "shop.cantAfford": "CAN'T AFFORD",
  "shop.leave": "🚪 DONE",
  "shop.empty": "Nothing left in stock.",
  "shop.emptySlot": "EMPTY",

  // ---- Economy HUD (economy.spec.todo.md, F9 #137) ----
  "play.level": "LV {level}",
  "play.gold": "{gold}g",
} as const;
