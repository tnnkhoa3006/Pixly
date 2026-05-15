import { memo, useEffect, useRef, useState } from 'react';
import { Plus, Eye, EyeOff, CheckSquare, Square, Trash2, GripVertical, Pencil, Combine } from 'lucide-react';
import type { Layer } from '../../types';
import { useStore } from '../../store';

interface RightSidebarProps {
  width: number;
  layers: Layer[];
  activeLayerId: string;
  selectedLayerIds: string[];
  onAddLayer: () => void;
  onDeleteLayer: (id: string) => void;
  onRenameLayer: (id: string, name: string) => void;
  onMergeLayers: () => void;
  onLayerClick: (id: string, isMulti: boolean) => void;
  onToggleLayerSelection: (id: string) => void;
  onReorderLayer: (oldIndex: number, newIndex: number) => void;
  onResizerPointerDown: (e: React.PointerEvent) => void;
}

export default memo(function RightSidebar({
  width, layers, activeLayerId, selectedLayerIds,
  onAddLayer, onDeleteLayer, onRenameLayer, onMergeLayers, onLayerClick, onToggleLayerSelection, onReorderLayer, onResizerPointerDown,
}: RightSidebarProps) {
  const [draggedVisualIndex, setDraggedVisualIndex] = useState<number | null>(null);
  const [dropTargetVisualIndex, setDropTargetVisualIndex] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<'top' | 'bottom' | null>(null);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const draggedLayerIdRef = useRef<string | null>(null);

  const reversedLayers = [...layers].reverse();
  const selectedInFrame = selectedLayerIds.filter(id => layers.some(layer => layer.id === id));
  const activeLayerIndex = layers.findIndex(layer => layer.id === activeLayerId);
  const canMergeLayers = selectedInFrame.length >= 2 || activeLayerIndex > 0;

  useEffect(() => {
    if (!editingLayerId) return;
    editInputRef.current?.focus();
    editInputRef.current?.select();
  }, [editingLayerId]);

  const beginRename = (layer: Layer) => {
    setEditingLayerId(layer.id);
    setDraftName(layer.name);
  };

  const commitRename = () => {
    if (!editingLayerId) return;
    onRenameLayer(editingLayerId, draftName);
    setEditingLayerId(null);
  };

  const cancelRename = () => {
    setEditingLayerId(null);
  };

  return (
    <div className="right-sidebar" style={{ width }}>
      <div className="sidebar-resizer right" onPointerDown={onResizerPointerDown} />
      <div className="right-sidebar-header">
        <span>Layers</span>
        <div className="right-sidebar-actions">
          <button
            className="tool-icon-btn"
            style={{ width: 26, height: 26 }}
            onClick={onMergeLayers}
            disabled={!canMergeLayers}
            title={selectedInFrame.length >= 2 ? 'Merge selected layers' : 'Merge active layer down'}
          >
            <Combine size={14} />
          </button>
          <button
            className="tool-icon-btn"
            style={{ width: 26, height: 26 }}
            onClick={onAddLayer}
            title="Add Layer"
          >
            <Plus size={14} />
          </button>
        </div>
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
              draggable={layers.length > 1 && editingLayerId !== layer.id}
              onClick={(e) => onLayerClick(layer.id, e.ctrlKey || e.metaKey)}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', layer.id);
                draggedLayerIdRef.current = layer.id;
                setDraggedVisualIndex(visualIndex);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                const draggedLayerId = draggedLayerIdRef.current || e.dataTransfer.getData('text/plain');
                if (!draggedLayerId || draggedLayerId === layer.id) return;
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
                const draggedLayerId = draggedLayerIdRef.current || e.dataTransfer.getData('text/plain');
                if (draggedLayerId && draggedLayerId !== layer.id && dropPosition) {
                  const fromReal = layers.findIndex(item => item.id === draggedLayerId);
                  const targetReal = layers.findIndex(item => item.id === layer.id);
                  if (fromReal !== -1 && targetReal !== -1) {
                    let toReal = dropPosition === 'top' ? targetReal + 1 : targetReal;
                    if (fromReal < toReal) toReal--;
                    toReal = Math.max(0, Math.min(toReal, layers.length - 1));
                    if (fromReal !== toReal) onReorderLayer(fromReal, toReal);
                  }
                }
                draggedLayerIdRef.current = null;
                setDraggedVisualIndex(null);
                setDropTargetVisualIndex(null);
                setDropPosition(null);
              }}
              onDragEnd={() => {
                draggedLayerIdRef.current = null;
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

                {editingLayerId === layer.id ? (
                  <input
                    ref={editInputRef}
                    className="layer-name-input"
                    value={draftName}
                    maxLength={80}
                    onChange={(e) => setDraftName(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitRename();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelRename();
                      }
                    }}
                  />
                ) : (
                  <span
                    className="layer-name"
                    title={layer.name}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      beginRename(layer);
                    }}
                  >
                    {layer.name}
                  </span>
                )}

                <button
                  className="layer-btn"
                  onClick={(e) => { e.stopPropagation(); beginRename(layer); }}
                  title="Rename Layer"
                >
                  <Pencil size={14} />
                </button>

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
