import { memo, useEffect, useRef, useState } from 'react';
import { Plus, Eye, EyeOff, CheckSquare, Square, Trash2, GripVertical, Pencil, Combine } from 'lucide-react';
import type { Layer } from '../../types';
import { useStore } from '../../store';

type LayerDropPosition = 'top' | 'bottom';
type LayerDropTarget = {
  layerId: string;
  visualIndex: number;
  position: LayerDropPosition;
};
type LayerPointerDrag = {
  layerId: string;
  pointerId: number;
  startX: number;
  startY: number;
  visualIndex: number;
  isDragging: boolean;
};

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
  const dropTargetLayerIdRef = useRef<string | null>(null);
  const dropPositionRef = useRef<LayerDropPosition | null>(null);
  const layerItemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const pointerDragRef = useRef<LayerPointerDrag | null>(null);
  const suppressClickRef = useRef(false);

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

  const resetDragState = () => {
    draggedLayerIdRef.current = null;
    dropTargetLayerIdRef.current = null;
    dropPositionRef.current = null;
    pointerDragRef.current = null;
    setDraggedVisualIndex(null);
    setDropTargetVisualIndex(null);
    setDropPosition(null);
  };

  const setLayerItemRef = (id: string) => (node: HTMLDivElement | null) => {
    if (node) layerItemRefs.current.set(id, node);
    else layerItemRefs.current.delete(id);
  };

  const getDropTargetFromPoint = (clientY: number, draggedLayerId: string): LayerDropTarget | null => {
    const candidates = reversedLayers
      .map((item, visualIndex) => ({
        layerId: item.id,
        visualIndex,
        element: layerItemRefs.current.get(item.id),
      }))
      .filter((item): item is { layerId: string; visualIndex: number; element: HTMLDivElement } => Boolean(item.element));

    if (candidates.length === 0) return null;

    const toTarget = (
      item: { layerId: string; visualIndex: number; element: HTMLDivElement },
      position: LayerDropPosition,
    ): LayerDropTarget | null => {
      if (item.layerId === draggedLayerId) return null;
      return { layerId: item.layerId, visualIndex: item.visualIndex, position };
    };

    for (const item of candidates) {
      const rect = item.element.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        return toTarget(item, clientY < rect.top + rect.height / 2 ? 'top' : 'bottom');
      }
      if (clientY < rect.top) return toTarget(item, 'top');
    }

    return toTarget(candidates[candidates.length - 1], 'bottom');
  };

  const setDropTarget = (target: LayerDropTarget | null) => {
    dropTargetLayerIdRef.current = target?.layerId ?? null;
    dropPositionRef.current = target?.position ?? null;
    setDropTargetVisualIndex(target?.visualIndex ?? null);
    setDropPosition(target?.position ?? null);
  };

  const reorderLayer = (draggedLayerId: string, targetLayerId: string, finalDropPosition: LayerDropPosition) => {
    if (draggedLayerId === targetLayerId) return;
    const fromReal = layers.findIndex(item => item.id === draggedLayerId);
    const targetReal = layers.findIndex(item => item.id === targetLayerId);
    if (fromReal === -1 || targetReal === -1) return;

    let toReal = finalDropPosition === 'top' ? targetReal + 1 : targetReal;
    if (fromReal < toReal) toReal--;
    toReal = Math.max(0, Math.min(toReal, layers.length - 1));
    if (fromReal !== toReal) onReorderLayer(fromReal, toReal);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, layerId: string, visualIndex: number) => {
    if (e.button !== 0 || layers.length <= 1 || editingLayerId === layerId) return;
    if ((e.target as Element).closest('button,input,textarea,select')) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    pointerDragRef.current = {
      layerId,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      visualIndex,
      isDragging: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = pointerDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.isDragging && Math.hypot(dx, dy) < 4) return;

    if (!drag.isDragging) {
      drag.isDragging = true;
      suppressClickRef.current = true;
      draggedLayerIdRef.current = drag.layerId;
      setDraggedVisualIndex(drag.visualIndex);
    }

    setDropTarget(getDropTargetFromPoint(e.clientY, drag.layerId));
    e.preventDefault();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = pointerDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    if (drag.isDragging) {
      const target = dropTargetLayerIdRef.current && dropPositionRef.current
        ? { layerId: dropTargetLayerIdRef.current, position: dropPositionRef.current }
        : getDropTargetFromPoint(e.clientY, drag.layerId);

      if (target) reorderLayer(drag.layerId, target.layerId, target.position);
      e.preventDefault();
      e.stopPropagation();
    }

    resetDragState();
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
              ref={setLayerItemRef(layer.id)}
              className={[
                'layer-item',
                isActive ? 'active' : '',
                isSelected ? 'selected' : '',
                isDragging ? 'dragging' : '',
                isDropTarget && dropPosition === 'top' ? 'drop-above' : '',
                isDropTarget && dropPosition === 'bottom' ? 'drop-below' : '',
              ].filter(Boolean).join(' ')}
              onClick={(e) => {
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  return;
                }
                onLayerClick(layer.id, e.ctrlKey || e.metaKey);
              }}
              onPointerDown={(e) => handlePointerDown(e, layer.id, visualIndex)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={resetDragState}
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
