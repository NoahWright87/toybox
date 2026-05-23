// Wolf player character quips — all user-facing text for combat, pickups, and events.
// The quip system in Hellzone.tsx picks randomly from each array and manages timing.

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

export const QUIPS: Record<QuipKey, string[]> = {
  // General kill (fired at combat lull; weapon-specific variants are mixed in)
  enemy_killed: [
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
  ],

  // Weapon-specific kill variants — mixed 50/50 with enemy_killed pool
  enemy_killed_claws: [
    "WHO NEEDS WEAPONS?",
    "FREE DECLAWING SERVICE!",
    "SCRATCH THAT.",
    "PAWS OF FURY!",
    "CLAWS MEET CLAWS.",
    "THE WOLF GOES IN BARE-PAWED!",
    "TOOTH AND CLAW. MOSTLY CLAW.",
  ],
  enemy_killed_subwoofer: [
    "SUBWOOFER GOES BRRR.",
    "STEADY SHOT.",
    "DROPPING THE BEAT!",
    "ONE BURST. ONE CAT.",
    "THE BEAT DROPS.",
  ],
  enemy_killed_woofer: [
    "RAPID FIRE, RAPID DEMISE!",
    "THAT'S A LITTER OF BULLETS!",
    "FULL AUTO FELINE!",
    "THE WOOFER HAS SPOKEN.",
    "SHREDDED!",
    "BARK BARK BARK!",
  ],
  enemy_killed_tennis: [
    "GAME, SET, MATCH!",
    "LOVE: WOLF. CATS: ZERO.",
    "NICE VOLLEY!",
    "WHO'S FETCH CHAMPION?",
    "OUT OF BOUNDS.",
    "DEUCE.",
    "THE BALL GOES TO... THE WOLF.",
  ],
  enemy_killed_flamethrower: [
    "WELL DONE.",
    "CRISPY KIBBLE!",
    "HOT DOG!",
    "CATS HATE FIRE. WHO KNEW.",
    "TOASTY!",
    "BARBECUED KITTY.",
    "EXTRA CRISPY!",
    "SMELLS LIKE VICTORY.",
  ],

  // Pickups — informational + character voice; show immediately
  pickup_health: [
    "+HEALTH! BACK IN ACTION.",
    "PATCHED UP! STILL IN THE FIGHT.",
    "+HEALTH! THIS OLD DOG AIN'T DONE YET!",
    "+HP! TAIL'S STILL WAGGING.",
    "HEALED AND HUNGRY.",
    "THE VET WOULD BE PROUD.",
  ],
  pickup_ammo_bullets: [
    "+BULLETS! NOW WE'RE BARKING!",
    "+AMMO! FRESH CLIP FOR THE WOOFER.",
    "+BULLETS! LET'S GO.",
    "BULLETS ACQUIRED. CATS BEWARE.",
    "+AMMO! LOADED AND READY.",
  ],
  pickup_ammo_balls: [
    "+TENNIS BALLS! MY FAVORITE!",
    "+BALLS! WHO WANTS TO PLAY FETCH?",
    "+TENNIS BALLS! OH BOY OH BOY!",
    "SERVE 'EM UP!",
    "+BALLS! THE LAUNCHER IS HUNGRY.",
  ],
  pickup_ammo_fuel: [
    "+FUEL! HOT DAWG!",
    "+FUEL! BURN BABY BURN.",
    "+FUEL CANISTER! FULL TANK, FULL FURY.",
    "+FUEL! THE FIRE LIVES ON.",
    "GASSED UP AND READY.",
  ],
  pickup_weapon: [
    "NEW TOY! OH BOY OH BOY!",
    "WHO'S A GOOD BOY WITH A NEW GUN?",
    "ARMED AND DANGEROUS.",
    "I'M KEEPING THIS.",
    "OOH. SHINY.",
  ],
  pickup_weapon_woofer: [
    "THE WOOFER! BARK BARK BARK!",
    "RAPID FIRE MODE: ENGAGED!",
    "A WOOFER! THIS CHANGES EVERYTHING.",
    "FULL AUTO WOLF!",
    "THE WOOFER IS ONLINE.",
  ],
  pickup_weapon_tennis: [
    "A TENNIS LAUNCHER?! HEEL YES!",
    "FETCH THIS, KITTIES!",
    "TENNIS LAUNCHER ACQUIRED!",
    "WHO WANTS TO PLAY?",
    "SERVE 'EM UP!",
  ],
  pickup_weapon_flamethrower: [
    "FLAMETHROWER! WHO'S A DANGEROUS BOY?",
    "FIRE UP THE GRILL!",
    "FLAMETHROWER! CATS AREN'T GOING TO LOVE THIS.",
    "NOW WE'RE COOKING WITH GAS!",
    "SOMETHING WICKED THIS WAY BURNS.",
  ],

  // Combat feedback — queued, fired at lull
  player_hurt: [
    "YIP!",
    "OW! THAT'S MY FUR!",
    "NO SCRATCHING!",
    "YOU'LL PAY FOR THAT!",
    "BAD KITTY!",
    "THAT ACTUALLY HURT.",
    "WATCH THE TEETH!",
    "EVERY DOG HAS ITS DAY.",
    "STILL STANDING.",
  ],
  player_low_health: [
    "NEED A VET OVER HERE!",
    "BARELY A WOLF ANYMORE...",
    "BLOOD IN MY FUR...",
    "NOT GOING DOWN LIKE THIS!",
    "CLINGING ON BY A CLAW...",
    "I'VE SURVIVED WORSE.",
    "STAY ALIVE, STAY ALIVE...",
    "ONE MORE HIT AND I'M DOG CHOW.",
  ],

  // Low ammo — queued, fired at lull
  player_low_ammo_bullets: [
    "RUNNING LOW ON BULLETS...",
    "CONSERVATION MODE. MAKE 'EM COUNT.",
    "LAST FEW ROUNDS.",
    "ALMOST OUT OF BULLETS...",
    "GONNA NEED MORE AMMO.",
  ],
  player_low_ammo_balls: [
    "ALMOST OUT OF TENNIS BALLS...",
    "LAST FEW BALLS. PLAY CAREFULLY.",
    "BALL SUPPLY RUNNING LOW.",
    "BETTER MAKE THESE COUNT.",
  ],
  player_low_ammo_fuel: [
    "FUEL RUNNING LOW...",
    "FLAMETHROWER ALMOST ON E.",
    "ALMOST OUT OF GAS...",
    "THE FIRE IS FADING.",
  ],

  // No ammo — shown immediately when trying to fire
  player_no_ammo_bullets: [
    "OUT OF BULLETS! SWITCH WEAPONS!",
    "DRY AS A BONE!",
    "THE WOOFER WENT SILENT.",
    "EMPTY! SWITCH!",
    "CLICK. SWITCH WEAPONS.",
  ],
  player_no_ammo_balls: [
    "NO TENNIS BALLS!",
    "ALL OUT OF BALLS.",
    "BALL DROUGHT!",
    "SOMEONE FETCH MORE BALLS.",
    "EMPTY LAUNCHER!",
  ],
  player_no_ammo_fuel: [
    "OUT OF FUEL!",
    "FLAMETHROWER ON E.",
    "NO GAS, NO FIRE.",
    "TANK EMPTY! SWITCH!",
    "THE FLAME IS OUT.",
  ],

  // Door interactions — shown immediately when E is pressed
  action_open_door: [
    "HERE, KITTY KITTY...",
    "LET'S GO HUNTING.",
    "COME OUT, COME OUT...",
    "WOOF.",
    "CLEARING THE ROOM.",
    "OPENING UP...",
    "SNIFF SNIFF... YEP. CATS.",
  ],
  action_close_door: [
    "NOBODY HOME.",
    "STAY.",
    "NOT YET.",
    "BUYING TIME.",
    "SEAL IT UP.",
    "BACK OFF.",
  ],

  // {color} is replaced at runtime with the key color in uppercase
  locked_door: [
    "LOCKED! NEED THE {color} KEY.",
    "IT'S LOCKED. FIND THE {color} KEY.",
    "A CAT LOCKED THIS. I NEED THE {color} KEY.",
    "NEED THE {color} KEY FIRST.",
    "BLOCKED. FIND THAT {color} KEY.",
  ],

  // Level events — shown immediately
  level_start: [
    "LET'S GO FETCH SOME SKULLS.",
    "HELL'S FULL OF CATS. MY FAVORITE.",
    "WHO SENT KITTIES TO FIGHT A WOLF?",
    "ANOTHER FLOOR. MORE CATS. PERFECT.",
    "I CAN SMELL THEM FROM HERE.",
    "THE WOLF IS HUNGRY.",
    "ROUND UP THE STRAYS.",
    "TIME TO HUNT.",
    "THEY DON'T KNOW WHAT'S COMING.",
  ],
  level_clear: [
    "ALL CATS ACCOUNTED FOR.",
    "CLEAN SWEEP!",
    "WHO'S A GOOD BOY? THIS WOLF.",
    "THE PACK WOULD BE PROUD.",
    "EVERY LAST ONE.",
    "EXIT'S OPEN. LET'S MOVE.",
    "DOGGO: 1. HELL: 0.",
    "ROOM CLEARED. GOOD DOG.",
    "NOT ONE SURVIVOR. NICE.",
  ],
  player_death: [
    "...GOOD DOG.",
    "THEY'LL NEED A BIGGER LITTER BOX.",
    "EVEN THE BEST WOLVES FALL.",
    "THE CAT GOT THE WOLF.",
    "DEAD AS A FIRE HYDRANT.",
    "THE CATS WIN... FOR NOW.",
    "RESPAWN. NOT DONE.",
    "WHIMPER.",
    "DOWN BUT NOT FORGOTTEN.",
  ],
};

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Picks a locked-door quip and substitutes the key color
export function pickLockedDoorQuip(color: string): string {
  return pickRandom(QUIPS.locked_door).replace('{color}', color.toUpperCase());
}
