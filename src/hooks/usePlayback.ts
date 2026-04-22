import { useRef, useCallback, useState } from 'react';
import type { Frame } from '../types';

interface UsePlaybackOptions {
  frames: Frame[];
  onFrameChange: (index: number) => void;
}

/**
 * Animation playback controller.
 * ONLY changes activeFrameIndex via the onFrameChange callback.
 * Does NOT touch Canvas directly — Canvas re-renders from state change in App.
 */
export function usePlayback({ frames, onFrameChange }: UsePlaybackOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const rafId = useRef<number>(0);
  const lastTime = useRef<number>(0);
  const elapsed = useRef<number>(0);
  const currentIndex = useRef<number>(0);

  // Keep latest frames accessible in the rAF callback
  const framesRef = useRef(frames);
  framesRef.current = frames;

  const onFrameChangeRef = useRef(onFrameChange);
  onFrameChangeRef.current = onFrameChange;

  const tick = useCallback((time: number) => {
    if (lastTime.current === 0) {
      lastTime.current = time;
    }

    const delta = time - lastTime.current;
    lastTime.current = time;
    elapsed.current += delta;

    const fs = framesRef.current;
    if (fs.length === 0) return;

    const frame = fs[currentIndex.current];
    const dur = frame?.duration ?? 100;

    if (elapsed.current >= dur) {
      elapsed.current -= dur;
      currentIndex.current = (currentIndex.current + 1) % fs.length;
      onFrameChangeRef.current(currentIndex.current);
    }

    rafId.current = requestAnimationFrame(tick);
  }, []);

  const play = useCallback((startIndex?: number) => {
    if (framesRef.current.length <= 1) return;
    currentIndex.current = startIndex ?? 0;
    lastTime.current = 0;
    elapsed.current = 0;
    setIsPlaying(true);
    rafId.current = requestAnimationFrame(tick);
  }, [tick]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafId.current);
    setIsPlaying(false);
    lastTime.current = 0;
    elapsed.current = 0;
  }, []);

  const toggle = useCallback((startIndex?: number) => {
    if (isPlaying) {
      stop();
    } else {
      play(startIndex);
    }
  }, [isPlaying, play, stop]);

  return { isPlaying, play, stop, toggle };
}
