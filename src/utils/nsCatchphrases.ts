export const NS_CATCHPHRASES = [
  '"A door to a world of possibilities."',
  '"Knock knock. Who\'s there? The future."',
  '"Opening doors you didn\'t know were closed."',
  '"Built for the information superhighway. And the side streets."',
  '"Because doors are better than windows.\u2122"',
  '"We put the \'soft\' in software."',
  '"Warning: may cause excessive productivity. Or none at all."',
  '"It\'s probably going to be fine."',
  '"The operating system your mother warned you about."',
  '"Now with 47% more bits."',
  '"Certified Pre-Owned\u2122 by Noahsoft."',
  '"Experience the journey. Don\'t ask about the destination."',
  '"Pushing the envelope. Occasionally opening it."',
  '"Where do you want to go today? (Please specify.)"',
  '"Technology for the rest of us. And also some of them."',
  '"Not responsible for lost data, time, or dignity."',
  '"Powered by dreams, caffeine, and questionable decisions."',
];

export function randomCatchphrase(): string {
  return NS_CATCHPHRASES[Math.floor(Math.random() * NS_CATCHPHRASES.length)];
}
