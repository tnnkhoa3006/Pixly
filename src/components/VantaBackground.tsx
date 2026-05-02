import React, { useState, useEffect, useRef } from 'react';

declare global {
  interface Window {
    VANTA: any;
  }
}

const VantaBackground: React.FC = () => {
  const [vantaEffect, setVantaEffect] = useState<any>(null);
  const vantaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // We need to wait for the scripts to load
    const initVanta = () => {
      if (!vantaEffect && vantaRef.current && window.VANTA) {
        try {
          const effect = window.VANTA.BIRDS({
            el: vantaRef.current,
            mouseControls: true,
            touchControls: true,
            gyroControls: false,
            minHeight: 200.0,
            minWidth: 200.0,
            scale: 1.0,
            scaleMobile: 1.0,
            backgroundColor: 0x13131f,
            color1: 0xff0036,
            color2: 0x4d6ff,
            birdSize: 1.5,
            wingSpan: 20.0,
            speedLimit: 5.0,
            separation: 50.0,
            alignment: 50.0,
            cohesion: 50.0,
            quantity: 4.0
          });
          setVantaEffect(effect);
        } catch (err) {
          console.error("Vanta init error:", err);
        }
      }
    };

    if (window.VANTA) {
      initVanta();
    } else {
      // If scripts aren't loaded yet, check again in a bit
      const timer = setInterval(() => {
        if (window.VANTA) {
          initVanta();
          clearInterval(timer);
        }
      }, 500);
      return () => clearInterval(timer);
    }

    return () => {
      if (vantaEffect) vantaEffect.destroy();
    };
  }, [vantaEffect]);

  return (
    <div
      ref={vantaRef}
      id="vanta-bg"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none'
      }}
    />
  );
};

export default VantaBackground;
