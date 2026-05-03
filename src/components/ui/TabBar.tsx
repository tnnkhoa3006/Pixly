import { useRef, useState } from 'react';
import { X, Plus, Film } from 'lucide-react';
import type { TabState } from '../../types';

interface TabBarProps {
  tabs: TabState[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  onDropFile: (file: File) => void;
  /** Whether the Animation tab is pinned */
  animationTabPinned?: boolean;
  /** Current view: canvas or animation */
  activeView?: 'canvas' | 'animation';
  /** Switch between canvas and animation view */
  onSelectView?: (view: 'canvas' | 'animation') => void;
  /** Remove the animation tab */
  onUnpinAnimationTab?: () => void;
}

export default function TabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onDropFile,
  animationTabPinned = false,
  activeView = 'canvas',
  onSelectView,
  onUnpinAnimationTab,
}: TabBarProps) {
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const [isDragOverBar, setIsDragOverBar] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  // ── Drag-and-drop .pixly files onto the tab bar ──
  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOverBar(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!barRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragOverBar(false);
      setDragOverTabId(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverBar(false);
    setDragOverTabId(null);
    const file = e.dataTransfer.files[0];
    if (file) onDropFile(file);
  };

  return (
    <div
      ref={barRef}
      className={`tab-bar ${isDragOverBar ? 'tab-bar-drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="tab-bar-scroll">
        {/* ── Project file tabs ── */}
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId && activeView === 'canvas';
          const isDragTarget = tab.id === dragOverTabId;
          return (
            <div
              key={tab.id}
              className={`tab-item ${isActive ? 'tab-item-active' : ''} ${isDragTarget ? 'tab-item-drag-target' : ''}`}
              onClick={() => { onSelectTab(tab.id); onSelectView?.('canvas'); }}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes('Files')) {
                  e.preventDefault();
                  setDragOverTabId(tab.id);
                }
              }}
              onDragLeave={() => setDragOverTabId(null)}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOverTabId(null);
                setIsDragOverBar(false);
                const file = e.dataTransfer.files[0];
                if (file) onDropFile(file);
              }}
              title={tab.filePath ?? tab.name}
            >
              {tab.isDirty && <span className="tab-dirty-dot" aria-label="unsaved" />}
              <span className="tab-name">{tab.name}</span>
              {tabs.length > 1 && (
                <button
                  className="tab-close-btn"
                  onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id); }}
                  title="Close tab"
                  aria-label="Close tab"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          );
        })}

        {/* ── Animation tab (pinned) ── */}
        {animationTabPinned && (
          <div
            className={`tab-item tab-item-animation ${activeView === 'animation' ? 'tab-item-active' : ''}`}
            onClick={() => onSelectView?.('animation')}
            title="Animation editor"
          >
            <Film size={12} style={{ flexShrink: 0, opacity: 0.8 }} />
            <span className="tab-name">Animation</span>
            <button
              className="tab-close-btn"
              onClick={(e) => { e.stopPropagation(); onUnpinAnimationTab?.(); }}
              title="Unpin animation tab"
              aria-label="Unpin animation tab"
            >
              <X size={11} />
            </button>
          </div>
        )}
      </div>

      {/* New tab button */}
      <button className="tab-new-btn" onClick={onNewTab} title="New project tab">
        <Plus size={14} />
      </button>

      {/* Drop hint overlay */}
      {isDragOverBar && (
        <div className="tab-drop-hint">
          Drop .pixly file to open in new tab
        </div>
      )}
    </div>
  );
}
