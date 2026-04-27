import { useState, useEffect, useRef } from 'react';
import type { MenuConfig, ActionMap } from './types';
import { Menu } from './Menu';

interface MenuBarProps {
  config: MenuConfig;
  actions: ActionMap;
}

export function MenuBar({ config, actions }: MenuBarProps) {
  const [activeMenuIndex, setActiveMenuIndex] = useState<number | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);

  const closeAll = () => setActiveMenuIndex(null);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        closeAll();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        e.preventDefault();
        if (activeMenuIndex === null) {
          setActiveMenuIndex(0);
        } else {
          closeAll();
        }
      } else if (e.key === 'Escape') {
        closeAll();
      } else if (activeMenuIndex !== null) {
        if (e.key === 'ArrowRight') {
          setActiveMenuIndex((prev) => (prev! + 1) % config.length);
        } else if (e.key === 'ArrowLeft') {
          setActiveMenuIndex((prev) => (prev! - 1 + config.length) % config.length);
        }
      }
    };

    document.addEventListener('mousedown', handleGlobalClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleGlobalClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeMenuIndex, config.length]);

  return (
    <div 
      ref={menuBarRef}
      className="menu-bar-container"
      style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', backgroundColor: '#222', borderBottom: '1px solid #333', padding: '2px 4px', gap: '4px', width: '100vw', flexWrap: 'nowrap', position: 'relative', zIndex: 200, userSelect: 'none', color: '#eee' }}
    >
      {config.map((menu, idx) => (
        <Menu
          key={idx}
          config={menu}
          actions={actions}
          isOpen={activeMenuIndex === idx}
          onOpen={() => {
            if (activeMenuIndex === idx) {
              closeAll();
            } else {
              setActiveMenuIndex(idx);
            }
          }}
          onHover={() => {
            if (activeMenuIndex !== null && activeMenuIndex !== idx) {
              setActiveMenuIndex(idx);
            }
          }}
          closeAll={closeAll}
        />
      ))}
    </div>
  );
}

export * from './types';
