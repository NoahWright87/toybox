import DuckHunt from "../experiences/DuckHunt/DuckHunt";
import StandaloneWindow from "../components/StandaloneWindow/StandaloneWindow";

export default function DuckHuntPage() {
  return (
    <StandaloneWindow
      title="Duck &amp; Learn"
      icon="🎯"
      helpContent={
        <>
          <ul>
            <li>Choose a <strong>math category</strong> and <strong>shooting difficulty</strong></li>
            <li>Read the prompt at the bottom, then <strong>click</strong> (or tap) the correct clay pigeon</li>
            <li><strong>Addition / Multiplication</strong> — one pigeon has the correct answer</li>
            <li><strong>Primes / Squares</strong> — multiple pigeons may be correct; hit them all for a bonus</li>
            <li>You lose a <strong>life</strong> if no correct pigeon is hit in a round</li>
            <li>Shoot <strong>faster</strong> for a speed bonus · hit all correct pigeons for a <strong>combo</strong> multiplier</li>
            <li>Clicking open sky uses a shot — make them count!</li>
          </ul>
        </>
      }
    >
      <DuckHunt />
    </StandaloneWindow>
  );
}
