import { useState, useEffect, useRef } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'done'>('loading');
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const duration = 2500;
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
    <div className={`sp-screen ${phase === 'done' ? 'sp-fadeout' : ''}`}>
      <div className="sp-window">
        {/* Left panel - Pokemon GIF */}
        <div className="sp-left">
          <img
            src="/pokemon  pixel art.gif"
            alt="Pixel art"
            className="sp-gif"
          />
        </div>

        {/* Right panel - Loading info */}
        <div className="sp-right">
          <img
            src="/Pixel It loading.gif"
            alt="Loading"
            className="sp-gif sp-gif-sm"
          />
          <div className="sp-text">
            <span className="sp-brand">Pixly</span>
            <span className="sp-sub">Pixel Art Editor</span>
          </div>
          <div className="sp-bar-wrap">
            <div className="sp-bar" style={{ width: `${progress}%` }} />
          </div>
          <span className="sp-pct">{progress}%</span>
        </div>
      </div>
    </div>
  );
}
