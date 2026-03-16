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
];
