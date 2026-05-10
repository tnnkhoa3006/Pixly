import { memo, useState } from 'react';
import { Plus, Eye, EyeOff, CheckSquare, Square, Trash2, GripVertical } from 'lucide-react';
import type { Layer } from '../../types';
import { useStore } from '../../store';

interface RightSidebarProps {
  width: number;
  layers: Layer[];
  activeLayerId: string;
  selectedLayerIds: string[];
  onAddLayer: () => void;
  onDeleteLayer: (id: string) => void;
  onLayerClick: (id: string, isMulti: boolean) => void;
  onToggleLayerSelection: (id: string) => void;
  onReorderLayer: (oldIndex: number, newIndex: number) => void;
  onResizerPointerDown: (e: React.PointerEvent) => void;
}

export default memo(function RightSidebar({
  width, layers, activeLayerId, selectedLayerIds,
  onAddLayer, onDeleteLayer, onLayerClick, onToggleLayerSelection, onReorderLayer, onResizerPointerDown,
}: RightSidebarProps) {
  const [draggedVisualIndex, setDraggedVisualIndex] = useState<number | null>(null);
  const [dropTargetVisualIndex, setDropTargetVisualIndex] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<'top' | 'bottom' | null>(null);

  const reversedLayers = [...layers].reverse();

  return (
    <div className="right-sidebar" style={{ width }}>
      <div className="sidebar-resizer right" onPointerDown={onResizerPointerDown} />
      <div className="right-sidebar-header">
        <span>Layers</span>
        <button className="tool-icon-btn" style={{ width: 26, height: 26 }} onClick={onAddLayer}><Plus size={14} /></button>
      </div>
      <div className="layer-list">
        {reversedLayers.map((layer, visualIndex) => {
          const isSelected = selectedLayerIds.includes(layer.id);
          const isActive = activeLayerId === layer.id;
          const isDragging = draggedVisualIndex === visualIndex;
          const isDropTarget = dropTargetVisualIndex === visualIndex;

          return (
            <div
              key={layer.id}
              className={[
                'layer-item',
                isActive ? 'active' : '',
                isSelected ? 'selected' : '',
                isDragging ? 'dragging' : '',
                isDropTarget && dropPosition === 'top' ? 'drop-above' : '',
                isDropTarget && dropPosition === 'bottom' ? 'drop-below' : '',
              ].filter(Boolean).join(' ')}
              draggable={layers.length > 1}
              onClick={(e) => onLayerClick(layer.id, e.ctrlKey || e.metaKey)}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                setDraggedVisualIndex(visualIndex);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggedVisualIndex === null || draggedVisualIndex === visualIndex) return;
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setDropTargetVisualIndex(visualIndex);
                setDropPosition(e.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom');
              }}
              onDragLeave={() => {
                if (dropTargetVisualIndex === visualIndex) {
                  setDropTargetVisualIndex(null);
                  setDropPosition(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedVisualIndex !== null && dropTargetVisualIndex !== null) {
                  const fromReal = layers.length - 1 - draggedVisualIndex;
                  let toReal = layers.length - 1 - dropTargetVisualIndex;
                  if (draggedVisualIndex < dropTargetVisualIndex && dropPosition === 'top') toReal++;
                  else if (draggedVisualIndex > dropTargetVisualIndex && dropPosition === 'bottom') toReal--;
                  if (fromReal !== toReal) onReorderLayer(fromReal, toReal);
                }
                setDraggedVisualIndex(null);
                setDropTargetVisualIndex(null);
                setDropPosition(null);
              }}
              onDragEnd={() => {
                setDraggedVisualIndex(null);
                setDropTargetVisualIndex(null);
                setDropPosition(null);
              }}
            >
              <div className="layer-item-top">
                <GripVertical size={14} className="layer-grip" />

                <button
                  className={`layer-btn ${layer.visible ? 'eye-active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); useStore.getState().toggleLayerVisibility(layer.id); }}
                  title="Toggle Visibility"
                >
                  {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>

                <button
                  className={`layer-btn ${isSelected ? 'select-active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); onToggleLayerSelection(layer.id); }}
                  title="Toggle Selection for Transform"
                >
                  {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                </button>

                <span className="layer-name">{layer.name}</span>

                <button className="layer-btn" onClick={(e) => { e.stopPropagation(); onDeleteLayer(layer.id); }} disabled={layers.length <= 1}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
