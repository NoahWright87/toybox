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
    description: "Fly through an infinite starfield. Click to boost.",
    category: "screensaver",
    path: "/starfield",
  },
  {
    id: "fireworks",
    title: "Fireworks",
    description: "Click anywhere to launch a firework. Click a lot.",
    category: "toy",
    path: "/fireworks",
  },
  {
    id: "bouncing-shapes",
    title: "Bouncing Shapes",
    description: "Colorful shapes bounce around. How many corner hits can you get?",
    category: "screensaver",
    path: "/bouncing-shapes",
  },
  {
    id: "typing-racer",
    title: "Typing Racer",
    description: "Type the phrase as fast as you can. WPM and accuracy tracked.",
    category: "educational",
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
    id: "ns-doors-97",
    title: "NS Doors 97",
    description: "A fake 90s desktop OS. Double-click icons to open apps. It's not Windows. It's a Door.™",
    category: "toy",
    path: "/doors97",
  },
];
