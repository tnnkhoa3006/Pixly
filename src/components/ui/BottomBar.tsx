import { memo } from 'react';
import { Grid3X3 } from 'lucide-react';

const DEFAULT_PALETTE = ['#000000', '#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'];

interface BottomBarProps {
  currentColor: string;
  gridSize: number;
  pixelSize: number;
  showGrid: boolean;
  pickerStatusText: string | null;
  onColorChange: (color: string) => void;
  onActivateBrush: () => void;
  onToggleGrid: () => void;
  coordsRef: React.RefObject<HTMLSpanElement | null>;
}

export default memo(function BottomBar({
  currentColor, gridSize, pixelSize, showGrid, pickerStatusText,
  onColorChange, onActivateBrush, onToggleGrid, coordsRef,
}: BottomBarProps) {
  return (
    <div className="bottom-bar">
      <div className="bottom-bar-section">
        <input type="color" value={currentColor} onChange={e => { onColorChange(e.target.value); onActivateBrush(); }} className="color-picker-input" />
        <div className="current-color-readout">
          <span className="current-color-chip" style={{ backgroundColor: currentColor }} />
          <span className="current-color-code">{currentColor.toUpperCase()}</span>
          {pickerStatusText && <span className="current-color-status">{pickerStatusText}</span>}
        </div>
        <div className="bottom-bar-palette">
          {DEFAULT_PALETTE.map(color => (
            <div key={color} className="palette-swatch" style={{ backgroundColor: color }} onClick={() => { onColorChange(color); onActivateBrush(); }} title={color.toUpperCase()} />
          ))}
        </div>
      </div>
      <div className="bottom-bar-divider" />
      <div className="bottom-bar-section bottom-bar-coords">
        <span ref={coordsRef} title="Cursor coordinates">X: -, Y: -</span>
      </div>
      <div className="bottom-bar-divider" />
      <div className="bottom-bar-section">
        <button onClick={onToggleGrid} className={`grid-toggle-btn${showGrid ? ' active' : ''}`} title="Toggle Grid (G)">
          <Grid3X3 size={16} />
        </button>
        <span className="grid-size-label" title="Canvas size">{gridSize}x{gridSize}</span>
      </div>
      <div className="bottom-bar-divider" />
      <div className="bottom-bar-section">
        <span>Zoom: {Math.round((pixelSize / 32) * 100)}%</span>
      </div>
    </div>
  );
});
