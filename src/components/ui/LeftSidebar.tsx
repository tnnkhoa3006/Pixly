import { memo } from 'react';
import { Brush, Eraser, PaintBucket, Pipette, Minus, Square, Circle, Sun, CloudRain, SprayCan, Type, BoxSelect, Move, Undo, Redo } from 'lucide-react';
import type { ToolType } from '../../types';

const RefreshCwIcon = ({ size }: { size: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
);
const MaximizeIcon = ({ size }: { size: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
);

interface LeftSidebarProps {
  width: number;
  currentTool: ToolType;
  customBrush: any;
  brushSize: number;
  canUndo: boolean;
  canRedo: boolean;
  onActivateTool: (tool: ToolType) => void;
  onBrushSizeChange: (size: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenBrushPopup: () => void;
  onResizerPointerDown: (e: React.PointerEvent) => void;
}

export default memo(function LeftSidebar({
  width, currentTool, customBrush, brushSize, canUndo, canRedo,
  onActivateTool, onBrushSizeChange, onUndo, onRedo, onOpenBrushPopup, onResizerPointerDown,
}: LeftSidebarProps) {
  return (
    <div className="sidebar" style={{ width }}>
      <div className="sidebar-resizer" onPointerDown={onResizerPointerDown} />

      <div className="sidebar-tools">
        <button
          className={`tool-icon-btn ${currentTool === 'brush' ? 'active' : ''} ${customBrush ? 'has-custom-brush' : ''}`}
          onClick={() => onActivateTool('brush')}
          onContextMenu={(e) => { e.preventDefault(); onOpenBrushPopup(); }}
          title="Brush (B) - Right click for custom brushes"
        >
          <Brush size={20} />
        </button>
        <button className={`tool-icon-btn ${currentTool === 'eraser' ? 'active' : ''}`} onClick={() => onActivateTool('eraser')} title="Eraser (E)"><Eraser size={20} /></button>
        <button className={`tool-icon-btn ${currentTool === 'fill' ? 'active' : ''}`} onClick={() => onActivateTool('fill')} title="Fill (G)"><PaintBucket size={20} /></button>
        <button className={`tool-icon-btn ${currentTool === 'picker' ? 'active' : ''}`} onClick={() => onActivateTool('picker')} title="Eyedropper (I)"><Pipette size={20} /></button>
        <button className={`tool-icon-btn ${currentTool === 'line' ? 'active' : ''}`} onClick={() => onActivateTool('line')} title="Line (L)"><Minus size={20} /></button>
        <button className={`tool-icon-btn ${currentTool === 'rect' ? 'active' : ''}`} onClick={() => onActivateTool('rect')} title="Rectangle Outline (R)"><Square size={20} /></button>
        <button className={`tool-icon-btn ${currentTool === 'circle' ? 'active' : ''}`} onClick={() => onActivateTool('circle')} title="Circle Outline (C)"><Circle size={20} /></button>
        <button className={`tool-icon-btn ${currentTool === 'lighten' ? 'active' : ''}`} onClick={() => onActivateTool('lighten')} title="Lighten (D)"><Sun size={20} /></button>
        <button className={`tool-icon-btn ${currentTool === 'darken' ? 'active' : ''}`} onClick={() => onActivateTool('darken')} title="Darken (Shift+D)"><CloudRain size={20} /></button>
        <button className={`tool-icon-btn ${currentTool === 'spray' ? 'active' : ''}`} onClick={() => onActivateTool('spray')} title="Spray Paint (A)"><SprayCan size={20} /></button>
        <button className={`tool-icon-btn ${currentTool === 'text' ? 'active' : ''}`} onClick={() => onActivateTool('text')} title="Text (T)"><Type size={20} /></button>
        <button className={`tool-icon-btn ${currentTool === 'select' ? 'active' : ''}`} onClick={() => onActivateTool('select')} title="Select (S)"><BoxSelect size={20} /></button>
      </div>

      <div className="tool-separator" />

      <div className="sidebar-tools">
        <button className={`tool-icon-btn frame-tool ${currentTool === 'frame-move' ? 'active' : ''}`} onClick={() => onActivateTool('frame-move')} title="Move Selection"><Move size={20} /></button>
        <button className={`tool-icon-btn frame-tool ${currentTool === 'frame-rotate' ? 'active' : ''}`} onClick={() => onActivateTool('frame-rotate')} title="Rotate Selection (drag around center)"><RefreshCwIcon size={20} /></button>
        <button className={`tool-icon-btn frame-tool ${currentTool === 'frame-scale' ? 'active' : ''}`} onClick={() => onActivateTool('frame-scale')} title="Scale Selection (drag toward or away from center)"><MaximizeIcon size={20} /></button>
      </div>

      <div className="tool-separator" />

      <div className="brush-size-container brush-size-control">
        <div className="brush-size-header">
          <span>Size</span>
          <span>{brushSize}px</span>
        </div>
        <input
          type="range"
          min="1"
          max="24"
          value={brushSize}
          onChange={(e) => onBrushSizeChange(parseInt(e.target.value, 10))}
          className="brush-size-slider"
        />
      </div>

      <div style={{ flex: 1 }} />

      <div className="sidebar-tools bottom">
        <button className="tool-icon-btn" onClick={onUndo} disabled={!canUndo}><Undo size={20} /></button>
        <button className="tool-icon-btn" onClick={onRedo} disabled={!canRedo}><Redo size={20} /></button>
      </div>
    </div>
  );
});
