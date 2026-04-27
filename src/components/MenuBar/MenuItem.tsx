import React, { useState, useRef, useEffect } from 'react';
import type { MenuNode, MenuItemConfig, ActionMap } from './types';
import { Separator } from './Separator';

interface MenuItemProps {
  node: MenuNode;
  actions: ActionMap;
  closeAll: () => void;
  depth?: number;
}

const ChevronRight = ({ size }: { size: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>
);

export function MenuItem({ node, actions, closeAll, depth = 0 }: MenuItemProps) {
  if ('type' in node && node.type === 'separator') {
    return <Separator />;
  }

  const config = node as MenuItemConfig;
  const hasSubMenu = !!config.items && config.items.length > 0;
  
  const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);
  const [flipX, setFlipX] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);
  const subMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSubMenuOpen && itemRef.current && subMenuRef.current) {
      const itemRect = itemRef.current.getBoundingClientRect();
      const subMenuWidth = subMenuRef.current.offsetWidth || 200;
      
      // If expanding to the right would overflow the screen, expand to the left
      if (itemRect.right + subMenuWidth > window.innerWidth) {
        setFlipX(true);
      } else {
        setFlipX(false);
      }
    }
  }, [isSubMenuOpen]);

  const handleMouseEnter = () => {
    if (hasSubMenu) setIsSubMenuOpen(true);
  };

  const handleMouseLeave = () => {
    if (hasSubMenu) setIsSubMenuOpen(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (config.disabled) return;
    if (hasSubMenu) return; // parent menus just toggle on hover
    
    e.stopPropagation();
    if (config.action && actions[config.action]) {
      actions[config.action]();
    }
    closeAll();
  };

  return (
    <div 
      ref={itemRef}
      className={`menu-item ${config.disabled ? 'disabled' : ''}`}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 16px',
        cursor: 'default',
        userSelect: 'none',
        color: '#ddd',
        fontSize: '13px',
        whiteSpace: 'nowrap',
        opacity: config.disabled ? 0.5 : 1,
        pointerEvents: config.disabled ? 'none' : 'auto',
        background: isSubMenuOpen ? '#3a3a3a' : 'transparent'
      }}
      onMouseEnter={(e) => {
        handleMouseEnter();
        if (!config.disabled) e.currentTarget.style.background = '#3a3a3a';
      }}
      onMouseLeave={(e) => {
        handleMouseLeave();
        if (!config.disabled) e.currentTarget.style.background = 'transparent';
      }}
      onClick={handleClick}
      role="menuitem"
    >
      <span>{config.label}</span>
      
      {config.shortcut && (
        <span className="menu-item-shortcut">
          {config.shortcut}
        </span>
      )}
      
      {hasSubMenu && (
        <span style={{ marginLeft: 16, color: '#888' }}>
          <ChevronRight size={14} />
        </span>
      )}

      {isSubMenuOpen && hasSubMenu && (
        <div 
          ref={subMenuRef}
          className="menu-dropdown"
          style={{ 
            ...(flipX ? { right: '100%', left: 'auto' } : { left: '100%', right: 'auto' }), 
            top: -5,
            marginTop: 0 
          }}
        >
          {config.items!.map((child, idx) => (
            <MenuItem 
              key={idx} 
              node={child} 
              actions={actions} 
              closeAll={closeAll} 
              depth={depth + 1} 
            />
          ))}
        </div>
      )}
    </div>
  );
}
