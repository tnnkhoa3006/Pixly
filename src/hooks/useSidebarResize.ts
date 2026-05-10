import { useEffect, type RefObject } from 'react';
import { useStore } from '../store';

export function useSidebarResize(
  isResizingLeft: RefObject<boolean>,
  isResizingRight: RefObject<boolean>,
) {
  const setLeftSidebarWidth = useStore(s => s.setLeftSidebarWidth);
  const setRightSidebarWidth = useStore(s => s.setRightSidebarWidth);

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (isResizingLeft.current) {
        setLeftSidebarWidth(Math.max(64, Math.min(e.clientX, 400)));
      }
      if (isResizingRight.current) {
        setRightSidebarWidth(Math.max(150, Math.min(window.innerWidth - e.clientX, 600)));
      }
    };
    const handleUp = () => {
      isResizingLeft.current = false;
      isResizingRight.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [isResizingLeft, isResizingRight, setLeftSidebarWidth, setRightSidebarWidth]);
}
