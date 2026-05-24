// Wolf player character quips and subtitle system types.
//
// All user-facing character text (and eventually audio) lives here.
// Hellzone.tsx calls showMessage() with a SubtitleCategory to control
// color, toggleability, and (future) audio playback.

// ── Types ─────────────────────────────────────────────────────────────────────

export type SubtitleCategory =
  | 'player'         // wolf's voice — toggleable
  | 'monster_tell'   // enemy attack telegraphs — ALWAYS shown (accessibility)
  | 'monster_voice'  // enemy ambient vocalizations — toggleable
  | 'info';          // system feedback (pickups, keys, tutorial) — always shown

export interface SubtitleSettings {
  player: boolean;
  monster_voice: boolean;
  // monster_tell and info are non-toggleable
}

export interface Quip {
  text: string;
  audio?: string;   // path to recorded clip, e.g. '/audio/hellzone/wolf-down-kitty.mp3'
}

export type QuipKey =
  | 'enemy_killed'
  | 'enemy_killed_claws'
  | 'enemy_killed_subwoofer'
  | 'enemy_killed_woofer'
  | 'enemy_killed_tennis'
  | 'enemy_killed_flamethrower'
  | 'pickup_health'
  | 'pickup_ammo_bullets'
  | 'pickup_ammo_balls'
  | 'pickup_ammo_fuel'
  | 'pickup_weapon'
  | 'pickup_weapon_woofer'
  | 'pickup_weapon_tennis'
  | 'pickup_weapon_flamethrower'
  | 'player_hurt'
  | 'player_low_health'
  | 'player_low_ammo_bullets'
  | 'player_low_ammo_balls'
  | 'player_low_ammo_fuel'
  | 'player_no_ammo_bullets'
  | 'player_no_ammo_balls'
  | 'player_no_ammo_fuel'
  | 'action_open_door'
  | 'action_close_door'
  | 'locked_door'
  | 'level_start'
  | 'level_clear'
  | 'player_death';

// ── Helpers ───────────────────────────────────────────────────────────────────

// Wraps plain text strings into Quip objects. When audio is recorded,
// replace individual entries with { text: '...', audio: '/audio/...' }.
function lines(...texts: string[]): Quip[] {
  return texts.map(text => ({ text }));
}

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Picks a locked-door quip and substitutes the key color.
export function pickLockedDoorQuip(color: string): Quip {
  const line = pickRandom(QUIPS.locked_door);
  return { text: line.text.replace('{color}', color.toUpperCase()), audio: line.audio };
}

// ── Exit confirmation quips ───────────────────────────────────────────────────
// Shown when the player tries to quit mid-session (classic 90s quit-heckle).

export interface ExitQuip {
  prompt: string;  // the heckle / question
  stay: string;    // "I'm staying" button label
  quit: string;    // "I'm really quitting" button label
}

export const EXIT_QUIPS: ExitQuip[] = [
  { prompt: "LEAVING ALREADY? THE CATS ARE WINNING.", stay: "NOT ON MY WATCH!", quit: "LET THEM WIN." },
  { prompt: "WHAT, SCARED OF A FEW CATS?", stay: "NEVER!", quit: "...MAYBE." },
  { prompt: "THE WOLF DOES NOT QUIT.", stay: "THAT'S RIGHT.", quit: "THIS WOLF DOES." },
  { prompt: "YOU'D REALLY RATHER LOOK AT A FAKE COMMAND PROMPT?", stay: "YOU'RE RIGHT. STAY.", quit: "ACTUALLY YES." },
  { prompt: "SERIOUSLY? NOW?", stay: "FINE. BACK TO HUNTING.", quit: "SERIOUSLY." },
  { prompt: "BUT WE WERE JUST GETTING STARTED!", stay: "YOU'RE RIGHT, LET'S GO.", quit: "LATER." },
  { prompt: "THE CATS WILL CELEBRATE WHEN YOU LEAVE.", stay: "OVER MY DEAD BODY.", quit: "FINE, LET THEM." },
  { prompt: "ONE MORE ROOM. JUST ONE MORE.", stay: "OKAY, ONE MORE.", quit: "I LIED." },
  { prompt: "YOU CALL YOURSELF A WOLF?", stay: "I AM A WOLF!", quit: "A TIRED WOLF." },
  { prompt: "EXIT TO WHERE? THE SAME COMPUTER?", stay: "FAIR POINT. STAYING.", quit: "I LIKE TERMINALS." },
  { prompt: "YOUR KILL COUNT IS EMBARRASSINGLY LOW FOR A QUITTER.", stay: "RUDE. BUT FINE. STAYING.", quit: "GOODBYE." },
  { prompt: "THE NEXT LEVEL HAS EXTRA CATS. YOU'LL MISS IT.", stay: "OH, NOW I'M STAYING.", quit: "SOUNDS TERRIBLE." },
];

export const QUIPS: Record<QuipKey, Quip[]> = {
  // General kill (fired at combat lull; weapon-specific variants are mixed in)
  enemy_killed: lines(
    "DOWN, KITTY!",
    "WHO'S A GOOD BOY?",
    "PAWS OFF!",
    "SIT. STAY. DEAD.",
    "FETCHED THAT ONE!",
    "MEOW THAT!",
    "DECLAWED.",
    "BAD CAT.",
    "DOMESTICATED!",
    "ONE LESS FURBALL.",
    "ROLL OVER FOREVER.",
    "HEEL.",
    "DE-CAT!",
    "STAY DOWN.",
    "NICE TRY, KITTY.",
  ),

  // Weapon-specific kill variants — mixed 50/50 with enemy_killed pool
  enemy_killed_claws: lines(
    "WHO NEEDS WEAPONS?",
    "FREE DECLAWING SERVICE!",
    "SCRATCH THAT.",
    "PAWS OF FURY!",
    "CLAWS MEET CLAWS.",
    "THE WOLF GOES IN BARE-PAWED!",
    "TOOTH AND CLAW. MOSTLY CLAW.",
  ),
  enemy_killed_subwoofer: lines(
    "SUBWOOFER GOES BRRR.",
    "STEADY SHOT.",
    "DROPPING THE BEAT!",
    "ONE BURST. ONE CAT.",
    "THE BEAT DROPS.",
  ),
  enemy_killed_woofer: lines(
    "RAPID FIRE, RAPID DEMISE!",
    "THAT'S A LITTER OF BULLETS!",
    "FULL AUTO FELINE!",
    "THE WOOFER HAS SPOKEN.",
    "SHREDDED!",
    "BARK BARK BARK!",
  ),
  enemy_killed_tennis: lines(
    "GAME, SET, MATCH!",
    "LOVE: WOLF. CATS: ZERO.",
    "NICE VOLLEY!",
    "WHO'S FETCH CHAMPION?",
    "OUT OF BOUNDS.",
    "DEUCE.",
    "THE BALL GOES TO... THE WOLF.",
  ),
  enemy_killed_flamethrower: lines(
    "WELL DONE.",
    "CRISPY KIBBLE!",
    "HOT DOG!",
    "CATS HATE FIRE. WHO KNEW.",
    "TOASTY!",
    "BARBECUED KITTY.",
    "EXTRA CRISPY!",
    "SMELLS LIKE VICTORY.",
  ),

  // Pickups — informational + character voice; fire immediately
  pickup_health: lines(
    "+HEALTH! BACK IN ACTION.",
    "PATCHED UP! STILL IN THE FIGHT.",
    "+HEALTH! THIS OLD DOG AIN'T DONE YET!",
    "+HP! TAIL'S STILL WAGGING.",
    "HEALED AND HUNGRY.",
    "THE VET WOULD BE PROUD.",
  ),
  pickup_ammo_bullets: lines(
    "+BULLETS! NOW WE'RE BARKING!",
    "+AMMO! FRESH CLIP FOR THE WOOFER.",
    "+BULLETS! LET'S GO.",
    "BULLETS ACQUIRED. CATS BEWARE.",
    "+AMMO! LOADED AND READY.",
  ),
  pickup_ammo_balls: lines(
    "+TENNIS BALLS! MY FAVORITE!",
    "+BALLS! WHO WANTS TO PLAY FETCH?",
    "+TENNIS BALLS! OH BOY OH BOY!",
    "SERVE 'EM UP!",
    "+BALLS! THE LAUNCHER IS HUNGRY.",
  ),
  pickup_ammo_fuel: lines(
    "+FUEL! HOT DAWG!",
    "+FUEL! BURN BABY BURN.",
    "+FUEL CANISTER! FULL TANK, FULL FURY.",
    "+FUEL! THE FIRE LIVES ON.",
    "GASSED UP AND READY.",
  ),
  pickup_weapon: lines(
    "NEW TOY! OH BOY OH BOY!",
    "WHO'S A GOOD BOY WITH A NEW GUN?",
    "ARMED AND DANGEROUS.",
    "I'M KEEPING THIS.",
    "OOH. SHINY.",
  ),
  pickup_weapon_woofer: lines(
    "THE WOOFER! BARK BARK BARK!",
    "RAPID FIRE MODE: ENGAGED!",
    "A WOOFER! THIS CHANGES EVERYTHING.",
    "FULL AUTO WOLF!",
    "THE WOOFER IS ONLINE.",
  ),
  pickup_weapon_tennis: lines(
    "A TENNIS LAUNCHER?! HEEL YES!",
    "FETCH THIS, KITTIES!",
    "TENNIS LAUNCHER ACQUIRED!",
    "WHO WANTS TO PLAY?",
    "SERVE 'EM UP!",
  ),
  pickup_weapon_flamethrower: lines(
    "FLAMETHROWER! WHO'S A DANGEROUS BOY?",
    "FIRE UP THE GRILL!",
    "FLAMETHROWER! CATS AREN'T GOING TO LOVE THIS.",
    "NOW WE'RE COOKING WITH GAS!",
    "SOMETHING WICKED THIS WAY BURNS.",
  ),

  // Combat feedback — queued and fired at lull
  player_hurt: lines(
    "YIP!",
    "OW! THAT'S MY FUR!",
    "NO SCRATCHING!",
    "YOU'LL PAY FOR THAT!",
    "BAD KITTY!",
    "THAT ACTUALLY HURT.",
    "WATCH THE TEETH!",
    "EVERY DOG HAS ITS DAY.",
    "STILL STANDING.",
  ),
  player_low_health: lines(
    "NEED A VET OVER HERE!",
    "BARELY A WOLF ANYMORE...",
    "BLOOD IN MY FUR...",
    "NOT GOING DOWN LIKE THIS!",
    "CLINGING ON BY A CLAW...",
    "I'VE SURVIVED WORSE.",
    "STAY ALIVE, STAY ALIVE...",
    "ONE MORE HIT AND I'M DOG CHOW.",
  ),

  // Low ammo — queued and fired at lull
  player_low_ammo_bullets: lines(
    "RUNNING LOW ON BULLETS...",
    "CONSERVATION MODE. MAKE 'EM COUNT.",
    "LAST FEW ROUNDS.",
    "ALMOST OUT OF BULLETS...",
    "GONNA NEED MORE AMMO.",
  ),
  player_low_ammo_balls: lines(
    "ALMOST OUT OF TENNIS BALLS...",
    "LAST FEW BALLS. PLAY CAREFULLY.",
    "BALL SUPPLY RUNNING LOW.",
    "BETTER MAKE THESE COUNT.",
  ),
  player_low_ammo_fuel: lines(
    "FUEL RUNNING LOW...",
    "FLAMETHROWER ALMOST ON E.",
    "ALMOST OUT OF GAS...",
    "THE FIRE IS FADING.",
  ),

  // No ammo — shown immediately on attempted fire
  player_no_ammo_bullets: lines(
    "OUT OF BULLETS! SWITCH WEAPONS!",
    "DRY AS A BONE!",
    "THE WOOFER WENT SILENT.",
    "EMPTY! SWITCH!",
    "CLICK. SWITCH WEAPONS.",
  ),
  player_no_ammo_balls: lines(
    "NO TENNIS BALLS!",
    "ALL OUT OF BALLS.",
    "BALL DROUGHT!",
    "SOMEONE FETCH MORE BALLS.",
    "EMPTY LAUNCHER!",
  ),
  player_no_ammo_fuel: lines(
    "OUT OF FUEL!",
    "FLAMETHROWER ON E.",
    "NO GAS, NO FIRE.",
    "TANK EMPTY! SWITCH!",
    "THE FLAME IS OUT.",
  ),

  // Door interactions — shown immediately on E press
  action_open_door: lines(
    "HERE, KITTY KITTY...",
    "LET'S GO HUNTING.",
    "COME OUT, COME OUT...",
    "WOOF.",
    "CLEARING THE ROOM.",
    "OPENING UP...",
    "SNIFF SNIFF... YEP. CATS.",
  ),
  action_close_door: lines(
    "NOBODY HOME.",
    "STAY.",
    "NOT YET.",
    "BUYING TIME.",
    "SEAL IT UP.",
    "BACK OFF.",
  ),

  // {color} is substituted at runtime with the key color in uppercase
  locked_door: lines(
    "LOCKED! NEED THE {color} KEY.",
    "IT'S LOCKED. FIND THE {color} KEY.",
    "A CAT LOCKED THIS. I NEED THE {color} KEY.",
    "NEED THE {color} KEY FIRST.",
    "BLOCKED. FIND THAT {color} KEY.",
  ),

  // Level events — shown immediately
  level_start: lines(
    "LET'S GO FETCH SOME SKULLS.",
    "HELL'S FULL OF CATS. MY FAVORITE.",
    "WHO SENT KITTIES TO FIGHT A WOLF?",
    "ANOTHER FLOOR. MORE CATS. PERFECT.",
    "I CAN SMELL THEM FROM HERE.",
    "THE WOLF IS HUNGRY.",
    "ROUND UP THE STRAYS.",
    "TIME TO HUNT.",
    "THEY DON'T KNOW WHAT'S COMING.",
  ),
  level_clear: lines(
    "ALL CATS ACCOUNTED FOR.",
    "CLEAN SWEEP!",
    "WHO'S A GOOD BOY? THIS WOLF.",
    "THE PACK WOULD BE PROUD.",
    "EVERY LAST ONE.",
    "EXIT'S OPEN. LET'S MOVE.",
    "DOGGO: 1. HELL: 0.",
    "ROOM CLEARED. GOOD DOG.",
    "NOT ONE SURVIVOR. NICE.",
  ),
  player_death: lines(
    "...GOOD DOG.",
    "THEY'LL NEED A BIGGER LITTER BOX.",
    "EVEN THE BEST WOLVES FALL.",
    "THE CAT GOT THE WOLF.",
    "DEAD AS A FIRE HYDRANT.",
    "THE CATS WIN... FOR NOW.",
    "RESPAWN. NOT DONE.",
    "WHIMPER.",
    "DOWN BUT NOT FORGOTTEN.",
  ),
};
