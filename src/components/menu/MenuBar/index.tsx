import { useState, useEffect, useRef } from 'react';
import { Download } from 'lucide-react';
import type { MenuConfig, ActionMap } from './types';
import { Menu } from './Menu';

interface MenuBarProps {
  config: MenuConfig;
  actions: ActionMap;
  title?: string;
  subtitle?: string;
}

export function MenuBar({ config, actions, title, subtitle }: MenuBarProps) {
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
    >
      {/* App logo + file name */}
      {title && (
        <div className="menu-bar-app-info">
          <div className="app-logo">{title}</div>
          {subtitle && (
            <div className="menu-bar-subtitle" title={subtitle}>
              {subtitle}
            </div>
          )}
        </div>
      )}

      {/* Menu items */}
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

      {/* Spacer */}
      <div className="menu-bar-spacer" />

      {/* Export button */}
      {actions.exportGif && (
        <button
          className="menu-bar-export-btn"
          onClick={actions.exportGif}
          title="Export GIF (Ctrl+E)"
        >
          <Download size={13} />
          Export
        </button>
      )}
    </div>
  );
}

export * from './types';
