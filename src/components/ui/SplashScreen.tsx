import { useState, useEffect, useRef } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
  standalone?: boolean;
}

export default function SplashScreen({ onComplete, standalone = false }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'done'>('loading');
  const onCompleteRef = useRef(onComplete);
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const duration = 2500;
    const start = performance.now();
    let frameId = 0;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const tick = (now: number) => {
      if (cancelled) return;

      const elapsed = now - start;
      const pct = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - pct, 3);
      setProgress(Math.round(eased * 100));

      if (pct < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        setPhase('done');
        timeoutId = setTimeout(() => {
          if (hasCompletedRef.current) return;
          hasCompletedRef.current = true;
          onCompleteRef.current();
        }, 400);
      }
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div className={`sp-screen ${standalone ? 'sp-standalone' : ''} ${phase === 'done' ? 'sp-fadeout' : ''}`}>
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
