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
  "enemy.placeholder.name": "Drone",
  "enemy.placeholder.description": "Cheap, expendable, everywhere.",

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
  "cancelled.restartPrompt": "PRESS ANY KEY OR TAP TO START A NEW CAREER",

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
} as const;
