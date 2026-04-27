import { useRef, useCallback, useState, useEffect } from 'react';
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
  const framesRef = useRef(frames);
  const onFrameChangeRef = useRef(onFrameChange);
  const tickRef = useRef<((time: number) => void) | null>(null);

  useEffect(() => {
    framesRef.current = frames;
  }, [frames]);

  useEffect(() => {
    onFrameChangeRef.current = onFrameChange;
  }, [onFrameChange]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafId.current);
    rafId.current = 0;
    setIsPlaying(false);
    lastTime.current = 0;
    elapsed.current = 0;
  }, []);

  useEffect(() => {
    tickRef.current = (time: number) => {
      if (lastTime.current === 0) {
        lastTime.current = time;
      }

      const delta = time - lastTime.current;
      lastTime.current = time;
      elapsed.current += delta;

      const currentFrames = framesRef.current;
      if (currentFrames.length <= 1) {
        stop();
        return;
      }

      const frame = currentFrames[currentIndex.current];
      const duration = frame?.duration ?? 100;

      if (elapsed.current >= duration) {
        elapsed.current -= duration;
        currentIndex.current = (currentIndex.current + 1) % currentFrames.length;
        onFrameChangeRef.current(currentIndex.current);
      }

      rafId.current = requestAnimationFrame((nextTime) => {
        tickRef.current?.(nextTime);
      });
    };
  }, [stop]);

  useEffect(() => () => {
    cancelAnimationFrame(rafId.current);
  }, []);

  const play = useCallback((startIndex?: number) => {
    if (framesRef.current.length <= 1) return;
    cancelAnimationFrame(rafId.current);
    currentIndex.current = startIndex ?? 0;
    lastTime.current = 0;
    elapsed.current = 0;
    setIsPlaying(true);
    rafId.current = requestAnimationFrame((time) => {
      tickRef.current?.(time);
    });
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
