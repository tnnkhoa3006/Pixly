import { useState, useEffect, useRef } from 'react';

interface LoadingScreenProps {
  onComplete: () => void;
}

export default function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'done'>('loading');
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const duration = 2200;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const pct = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - pct, 3);
      setProgress(Math.round(eased * 100));

      if (pct < 1) {
        requestAnimationFrame(tick);
      } else {
        setPhase('done');
        setTimeout(() => onCompleteRef.current(), 400);
      }
    };

    requestAnimationFrame(tick);
  }, []);

  return (
    <div className={`ld-screen ${phase === 'done' ? 'ld-fadeout' : ''}`}>
      <div className="ld-content">
        <img
          src="/Pixel It loading.gif"
          alt="Loading"
          className="ld-gif ld-gif-main"
        />
        <div className="ld-text">
          <span className="ld-brand">Pixly</span>
          <span className="ld-sub">Pixel Art Editor</span>
        </div>
        <div className="ld-bar-wrap">
          <div className="ld-bar" style={{ width: `${progress}%` }} />
        </div>
        <span className="ld-pct">{progress}%</span>
      </div>
    </div>
  );
}
