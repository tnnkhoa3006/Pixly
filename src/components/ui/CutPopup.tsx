import { memo } from 'react';
import { BoxSelect, Scissors } from 'lucide-react';
import type { CutMode } from '../../types';

interface CutPopupProps {
  cutMode: CutMode;
  onSelectMode: (mode: CutMode) => void;
  onClose: () => void;
}

const MODES: { mode: CutMode; label: string; hint: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { mode: 'lasso', label: 'Lasso', hint: 'Draw freely around a part, release to cut it to a new layer.', icon: Scissors },
  { mode: 'marquee', label: 'Marquee', hint: 'Drag a rectangular selection like Photoshop marquee.', icon: BoxSelect },
];

export default memo(function CutPopup({
  cutMode, onSelectMode, onClose,
}: CutPopupProps) {
  return (
    <div className="brush-popup-overlay" onPointerDown={onClose}>
      <div className="brush-popup-content cut-popup-content" onPointerDown={(e) => e.stopPropagation()}>
        <div className="brush-popup-header">
          <h3>Cut to Layer</h3>
          <p>Select an area like Photoshop, then Pixly moves those pixels to a new layer.</p>
        </div>

        <div className="cut-popup-section">
          <h4>Selection tools</h4>
          <div className="cut-mode-list">
            {MODES.map(({ mode, label, hint, icon: Icon }) => (
              <button
                key={mode}
                className={`cut-mode-item ${cutMode === mode ? 'active' : ''}`}
                onClick={() => {
                  onSelectMode(mode);
                  onClose();
                }}
              >
                <Icon size={16} />
                <span>
                  <strong>{label}</strong>
                  <small>{hint}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
