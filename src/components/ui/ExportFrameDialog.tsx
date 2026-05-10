import { useState, useEffect } from 'react';
import { X, Download, Check } from 'lucide-react';
import type { Frame } from '../../types';
import { FORMAT_OPTIONS } from '../../lib/imageExport';

interface ExportFrameDialogProps {
  frames: Frame[];
  activeFrameIndex: number;
  onConfirm: (frameIndices: number[], format: string) => void;
  onCancel: () => void;
}

export default function ExportFrameDialog({ frames, activeFrameIndex, onConfirm, onCancel }: ExportFrameDialogProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set([activeFrameIndex]));
  const [format, setFormat] = useState('png');

  const allSelected = selectedIndices.size === frames.length;

  const toggleFrame = (index: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        if (next.size > 1) next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const selectAll = () => setSelectedIndices(new Set(frames.map((_, i) => i)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && selectedIndices.size > 0) onConfirm(Array.from(selectedIndices).sort((a, b) => a - b), format);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIndices, format]);

  return (
    <div className="npd-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="npd-dialog">
        <div className="npd-header">
          <span className="npd-title">Export Frame as Image</span>
          <button className="npd-close" onClick={onCancel} title="Cancel">
            <X size={14} />
          </button>
        </div>

        <div className="npd-body">
          <div className="npd-field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="npd-label" style={{ margin: 0 }}>Select Frames</label>
              <button
                className="npd-preset"
                onClick={selectAll}
                style={{ padding: '2px 8px', fontSize: 11 }}
              >
                {allSelected ? 'All Selected' : 'Select All'}
              </button>
            </div>
            <div className="npd-frame-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 6, maxHeight: 200, overflow: 'auto', padding: '4px 0', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {frames.map((_, i) => {
                const isSelected = selectedIndices.has(i);
                return (
                  <button
                    key={i}
                    className={`npd-preset ${isSelected ? 'active' : ''}`}
                    onClick={() => toggleFrame(i)}
                    style={{ padding: '8px 4px', position: 'relative' }}
                  >
                    {isSelected && <Check size={12} style={{ position: 'absolute', top: 4, right: 4 }} />}
                    <span className="npd-preset-size" style={{ fontSize: 14 }}>{i + 1}</span>
                    <span className="npd-preset-label">
                      {i === activeFrameIndex ? 'active' : `frame`}
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
              {selectedIndices.size} of {frames.length} frame{frames.length > 1 ? 's' : ''} selected
            </div>
          </div>

          <div className="npd-field">
            <label className="npd-label">Format</label>
            <select
              className="npd-input"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            >
              {FORMAT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="npd-footer">
          <button className="npd-btn-cancel" onClick={onCancel}>Cancel</button>
          <button
            className="npd-btn-create"
            disabled={selectedIndices.size === 0}
            onClick={() => onConfirm(Array.from(selectedIndices).sort((a, b) => a - b), format)}
          >
            <Download size={13} />
            Export{selectedIndices.size > 1 ? ` (${selectedIndices.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
