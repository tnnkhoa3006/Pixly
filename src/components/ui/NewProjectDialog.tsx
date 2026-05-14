import { useState, useEffect, useRef } from 'react';
import { X, Plus } from 'lucide-react';
import type { GridSizeType } from '../../types';

const SIZE_PRESETS: { size: number; label: string }[] = [
  { size: 16, label: 'Icon' },
  { size: 32, label: 'Small' },
  { size: 64, label: 'Tile' },
  { size: 128, label: 'Sprite' },
];
const MAX_SIZE = 1024;
const MAX_AREA = 1024 * 1024;

interface NewProjectDialogProps {
  onConfirm: (size: GridSizeType, name: string) => void;
  onCancel: () => void;
}

export default function NewProjectDialog({ onConfirm, onCancel }: NewProjectDialogProps) {
  const [selectedPreset, setSelectedPreset] = useState<number | null>(32);
  const [customWidth, setCustomWidth] = useState('200');
  const [customHeight, setCustomHeight] = useState('300');
  const [customError, setCustomError] = useState('');
  const [projectName, setProjectName] = useState('Untitled');
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.select();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') handleCreate();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedPreset, customWidth, customHeight, projectName]);

  const handleCreate = () => {
    let size: GridSizeType;
    if (selectedPreset !== null) {
      size = selectedPreset;
    } else {
      const width = parseInt(customWidth, 10);
      const height = parseInt(customHeight, 10);
      if (isNaN(width) || isNaN(height) || width < 1 || height < 1) {
        setCustomError('Please enter valid width and height');
        return;
      }
      if (width > MAX_SIZE || height > MAX_SIZE) {
        setCustomError(`Max side is ${MAX_SIZE}px`);
        return;
      }
      if (width * height > MAX_AREA) {
        setCustomError(`Max canvas area is ${MAX_AREA.toLocaleString()} pixels`);
        return;
      }
      size = { width, height };
    }
    const name = projectName.trim() || 'Untitled';
    onConfirm(size, name);
  };

  return (
    <div className="npd-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="npd-dialog">
        <div className="npd-header">
          <span className="npd-title">New Project</span>
          <button className="npd-close" onClick={onCancel} title="Cancel">
            <X size={14} />
          </button>
        </div>

        <div className="npd-body">
          <div className="npd-field">
            <label className="npd-label">Project Name</label>
            <input
              ref={nameInputRef}
              className="npd-input"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Untitled"
              maxLength={64}
            />
          </div>

          <div className="npd-field">
            <label className="npd-label">Canvas Size</label>
            <div className="npd-presets">
              {SIZE_PRESETS.map(({ size, label }) => (
                <button
                  key={size}
                  className={`npd-preset ${selectedPreset === size ? 'active' : ''}`}
                  onClick={() => { setSelectedPreset(size); setCustomError(''); }}
                >
                  <span className="npd-preset-size">{size}x{size}</span>
                  <span className="npd-preset-label">{label}</span>
                </button>
              ))}
              <button
                className={`npd-preset ${selectedPreset === null ? 'active' : ''}`}
                onClick={() => setSelectedPreset(null)}
                title="Custom size"
              >
                <span className="npd-preset-size" style={{ fontSize: '16px' }}>+</span>
                <span className="npd-preset-label">Custom</span>
              </button>
            </div>

            {selectedPreset === null && (
              <div className="npd-custom-row">
                <input
                  type="number"
                  className="npd-input"
                  placeholder="W"
                  min={1}
                  max={MAX_SIZE}
                  value={customWidth}
                  onChange={(e) => { setCustomWidth(e.target.value); setCustomError(''); }}
                  autoFocus
                  style={{ width: 100 }}
                />
                <span className="npd-unit">x</span>
                <input
                  type="number"
                  className="npd-input"
                  placeholder="H"
                  min={1}
                  max={MAX_SIZE}
                  value={customHeight}
                  onChange={(e) => { setCustomHeight(e.target.value); setCustomError(''); }}
                  style={{ width: 100 }}
                />
                <span className="npd-unit">px</span>
              </div>
            )}
            {customError && <div className="npd-error">{customError}</div>}
          </div>
        </div>

        <div className="npd-footer">
          <button className="npd-btn-cancel" onClick={onCancel}>Cancel</button>
          <button className="npd-btn-create" onClick={handleCreate}>
            <Plus size={13} />
            Create Project
          </button>
        </div>
      </div>
    </div>
  );
}
