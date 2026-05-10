import { memo } from 'react';
import { Brush, Trash } from 'lucide-react';

interface BrushPopupProps {
  customBrush: { pixels: (string | null)[][]; width: number; height: number } | null;
  savedBrushes: { pixels: (string | null)[][]; width: number; height: number }[];
  currentColor: string;
  onSelectDefault: () => void;
  onSelectBrush: (brush: { pixels: (string | null)[][]; width: number; height: number }) => void;
  onDeleteBrush: (idx: number) => void;
  onClose: () => void;
}

export default memo(function BrushPopup({
  customBrush, savedBrushes, currentColor,
  onSelectDefault, onSelectBrush, onDeleteBrush, onClose,
}: BrushPopupProps) {
  return (
    <div className="brush-popup-overlay" onPointerDown={onClose}>
      <div className="brush-popup-content" onPointerDown={(e) => e.stopPropagation()}>
        <div className="brush-popup-header">
          <h3>Brushes</h3>
          <p>To assign a custom brush - simply use the select tool and select the desired area. Use hashtag #brushes to get your brush added.</p>
        </div>
        <div className="brush-popup-body">
          <h4>Brushes:</h4>
          <div className="brush-grid">
            <div className={`brush-item ${customBrush === null ? 'active' : ''}`} onClick={onSelectDefault} title="Default Brush (1px)">
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                <Brush size={32} />
              </div>
            </div>
            {savedBrushes.map((brush, idx) => (
              <div key={idx} className="brush-item" onClick={() => onSelectBrush(brush)}>
                <canvas
                  width={brush.width}
                  height={brush.height}
                  ref={(canvas) => {
                    if (!canvas) return;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;
                    ctx.clearRect(0, 0, brush.width, brush.height);
                    for (let y = 0; y < brush.height; y++) {
                      for (let x = 0; x < brush.width; x++) {
                        const px = brush.pixels[y]?.[x];
                        if (px) {
                          ctx.fillStyle = px === 'CURRENT' ? currentColor : px;
                          ctx.fillRect(x, y, 1, 1);
                        }
                      }
                    }
                  }}
                  style={{ imageRendering: 'pixelated', width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
                />
                <button className="brush-item-delete" onClick={(e) => { e.stopPropagation(); onDeleteBrush(idx); }} title="Delete Brush"><Trash size={14} /></button>
              </div>
            ))}
            {savedBrushes.length === 0 && (
              <div style={{ gridColumn: '1 / -1', color: '#666', fontSize: '12px', padding: '10px 0' }}>No brushes saved yet. Create a selection and click the "New Brush" button!</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
