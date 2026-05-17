export interface Experience {
  id: string;
  title: string;
  description: string;
  category: "screensaver" | "game" | "toy" | "educational";
  path: string;
}

export const experiences: Experience[] = [
  {
    id: "starfield",
    title: "Starfield",
    description: "Warp through an infinite starfield at configurable speed.",
    category: "screensaver",
    path: "/starfield",
  },
  {
    id: "fireworks",
    title: "Fireworks",
    description: "Automatic fireworks burst across the sky in a continuous light show.",
    category: "screensaver",
    path: "/fireworks",
  },
  {
    id: "bouncing-shapes",
    title: "Bouncing Shapes",
    description: "Colorful shapes bounce endlessly around a dark canvas.",
    category: "screensaver",
    path: "/bouncing-shapes",
  },
  {
    id: "scrolling-text",
    title: "Scrolling Text",
    description: "A classic bouncing marquee screensaver. Show the time, a catchphrase, or your own message.",
    category: "screensaver",
    path: "/scrolling-text",
  },
  {
    id: "bouncing-polygons",
    title: "Bouncing Polygons",
    description: "Polygons with independently-bouncing vertices trace rainbow trails across the screen.",
    category: "screensaver",
    path: "/bouncing-polygons",
  },
  {
    id: "raining-emojis",
    title: "Raining Emojis",
    description: "A parade of colorful emojis rains down the screen with a parallax depth effect.",
    category: "screensaver",
    path: "/raining-emojis",
  },
  {
    id: "typing-racer",
    title: "Type 'Em Up",
    description: "Words fall from above — type them to blast them before they reach your ship!",
    category: "game",
    path: "/typing-racer",
  },
  {
    id: "number-muncher",
    title: "Nom Nom Numerals",
    description: "Guide the critter and munch only numbers that match the selected rule.",
    category: "educational",
    path: "/number-muncher",
  },
  {
    id: "tic-tac-toe",
    title: "Tic-Tac-Toe",
    description: "Classic Tic-Tac-Toe on 3×3, 5×5, or 7×7 grids. Play a friend or the computer.",
    category: "game",
    path: "/tic-tac-toe",
  },
  {
    id: "word-whirlwind",
    title: "Word Whirlwind",
    description: "Unscramble the letters and find every hidden word. Freeplay, Standard, or Strict — how many can you get?",
    category: "game",
    path: "/word-whirlwind",
  },
  {
    id: "words",
    title: "WORDS",
    description: "Guess the hidden word in six tries. Pick your word length — 4 to 8 letters. Longer words are harder.",
    category: "game",
    path: "/words",
  },
  {
    id: "bomb-finder",
    title: "Bomb Finder",
    description: "Classic mine-sweeping puzzle. Flag the bombs, clear the field. Don't go boom.",
    category: "game",
    path: "/bomb-finder",
  },
  {
    id: "duck-hunt",
    title: "Duck & Learn",
    description: "Shoot clay pigeons with the right answers. Addition, multiplication, primes, squares — aim fast for bonus points!",
    category: "educational",
    path: "/duck-hunt",
  },
  {
    id: "ns-doors-97",
    title: "NS Doors 97",
    description: "A fake 90s desktop OS. Double-click icons to open apps. It's not Windows. It's a Door.™",
    category: "toy",
    path: "/doors97",
  },
  {
    id: "ns-tos",
    title: "NS-TOS",
    description: "Noahsoft Terminal Operating System. The command line beneath NS Doors 97.",
    category: "toy",
    path: "/ns-tos",
  },
  {
    id: "hell",
    title: "HELL",
    description: "A 1994 shareware FPS. Procedural BSP maps, raycaster engine, 3 enemy types. © Ego Software Inc.",
    category: "game",
    path: "/hell",
  },
  {
    id: "pool",
    title: "8-Ball Pool",
    description: "Top-down 8-ball pool. Aim with the mouse, drag back for power, apply English for spin. Play a friend or the computer.",
    category: "game",
    path: "/pool",
  },
  {
    id: "ns-art",
    title: "NS Art",
    description: "A retro paint program. Draw, spray, fill, and export your masterpiece as a PNG.",
    category: "toy",
    path: "/art",
  },
  {
    id: "midi-editor",
    title: "MIDI Editor",
    description: "A retro piano roll and step sequencer. Draw melodies, program drums, and play them back.",
    category: "toy",
    path: "/midi-editor",
  },
  {
    id: "chain-reaction",
    title: "Chain Reaction",
    description: "Guess letters to reveal a chain of words linked end-to-end. Connect START to END before your lives run out.",
    category: "game",
    path: "/chain-reaction",
  },
];
