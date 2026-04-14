const MESSAGES = [
  "This feature is under construction. Please check back in 1999.",
  "ERROR: Feature not found. Have you tried turning it off and on again?",
  "Pardon our dust! Noahsoft engineers are working around the clock (on a Pentium II).",
  "This action requires NS Doors 98 Upgrade Pack. Coming never.",
  "FATAL ERROR: Too much fun attempted at once.",
  "General protection fault in module FUN.DLL. Please restart your enjoyment.",
  "This program has performed an illegal operation and will be shut down. Just kidding. Maybe.",
  "Please insert Disk 2 of 47 to continue.",
  "Your computer is low on fun. Close some windows and try again.",
  "Error 404: Feature not found in this dimension. Try 1998.",
  "Noahsoft regrets to inform you: this button does nothing. Have a great day.",
  "The wizard you are looking for is on vacation. He'll be back in 2002.",
];

export function missingFeatureMessage(): string {
  return MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
}
