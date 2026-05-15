import { useNavigate } from 'react-router-dom';
import Pool from '../experiences/Pool/Pool';
import StandaloneWindow from '../components/StandaloneWindow/StandaloneWindow';

export default function PoolPage() {
  const navigate = useNavigate();
  return (
    <StandaloneWindow
      title="8-Ball Pool"
      icon="🎱"
      helpContent={
        <>
          <ul>
            <li>Move the mouse around the cue ball to <strong>aim</strong></li>
            <li>Click and <strong>drag back</strong> to set power, release to shoot</li>
            <li>Click the <strong>English</strong> circle to apply spin — top/back/side</li>
            <li>Sink all your balls (solids <em>or</em> stripes), then pocket the <strong>8-ball</strong> to win</li>
            <li>Groups are assigned on the first ball potted after the break</li>
            <li>Sinking the 8-ball early, or scratching while shooting it, is an instant loss</li>
          </ul>
        </>
      }
    >
      <Pool onQuit={() => navigate('/doors97', { state: { skipBoot: true } })} />
    </StandaloneWindow>
  );
}
