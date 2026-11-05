import { useEffect, useRef, useState } from 'react';

const HOLD_MS = 1200;
const R = 118;
const C = 2 * Math.PI * R;

// Hold mode: press and hold for ~1 s. Tap mode: a single press fires immediately.
// Nothing audible or visible confirms the trigger on this control; feedback is handled by the page.
export default function SosButton({ mode = 'hold', onTrigger, disabled = false }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const start = (source) => {
    if (disabled) return;
    if (mode === 'tap') {
      onTrigger(source);
      return;
    }
    setHolding(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setHolding(false);
      onTrigger(source);
    }, HOLD_MS);
  };

  const cancel = () => {
    clearTimeout(timer.current);
    setHolding(false);
  };

  const onKeyDown = (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      start('keyboard');
    }
  };
  const onKeyUp = (e) => {
    if (e.key === ' ' || e.key === 'Enter') cancel();
  };

  return (
    <button
      type="button"
      className={`sos${holding ? ' is-holding' : ''}`}
      style={{ '--hold-ms': `${HOLD_MS}ms`, '--circ': C }}
      onPointerDown={() => start(mode === 'tap' ? 'tap' : 'hold')}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={cancel}
      aria-label={mode === 'tap' ? 'Send silent request for help' : 'Press and hold to send a silent request for help'}
    >
      <svg className="sos-ring" viewBox="0 0 260 260" aria-hidden="true">
        <circle className="sos-track" cx="130" cy="130" r={R} />
        <circle className="sos-progress" cx="130" cy="130" r={R} strokeDasharray={C} />
      </svg>
      <span className="sos-core" aria-hidden="true">
        <span className="sos-label">{mode === 'tap' ? 'Tap' : 'Hold'}</span>
      </span>
    </button>
  );
}
