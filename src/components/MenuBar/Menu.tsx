import React, { useRef } from 'react';
import type { TopLevelMenu, ActionMap } from './types';
import { MenuItem } from './MenuItem';

interface MenuProps {
  config: TopLevelMenu;
  actions: ActionMap;
  isOpen: boolean;
  onOpen: () => void;
  onHover: () => void;
  closeAll: () => void;
}

export function Menu({ config, actions, isOpen, onOpen, onHover, closeAll }: MenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  return (
    <div 
      style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
      ref={menuRef}
      onMouseEnter={onHover}
    >
      <button
        className={`menu-btn ${isOpen ? 'open' : ''}`}
        style={{
          padding: '4px 12px',
          fontSize: '13px',
          borderRadius: '4px',
          outline: 'none',
          background: isOpen ? '#3a3a3a' : 'transparent',
          border: 'none',
          color: isOpen ? '#fff' : '#ccc',
          cursor: 'pointer',
          whiteSpace: 'nowrap'
        }}
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {config.label}
      </button>

      {isOpen && (
        <div 
          className="menu-dropdown"
          onClick={(e) => e.stopPropagation()}
        >
          {config.items.map((child, idx) => (
            <MenuItem 
              key={idx} 
              node={child} 
              actions={actions} 
              closeAll={closeAll} 
            />
          ))}
        </div>
      )}
    </div>
  );
}
