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
    title: "Number Muncher",
    description: "Navigate the grid and eat numbers that match the rule.",
    category: "educational",
    path: "/number-muncher",
  },
];
