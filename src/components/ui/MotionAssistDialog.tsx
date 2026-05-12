import { useState, useEffect, useRef, useCallback } from 'react';
import { Wind, ArrowDownUp, RotateCcw, Zap, Target, Flame } from 'lucide-react';

import { getAllTemplates } from '../../lib/motion/templates';
import { generateSuggestions } from '../../lib/motion/engine';
import type { MotionConfig, EasingType, SuggestionFrame } from '../../lib/motion/types';
import type { Frame } from '../../types';

interface MotionAssistDialogProps {
  currentFrame: Frame;
  gridSize: number;
  onConfirm: (config: MotionConfig) => void;
  onCancel: () => void;
}

const EASING_OPTIONS: { value: EasingType; label: string }[] = [
  { value: 'linear', label: 'Linear' },
  { value: 'easeIn', label: 'Ease In' },
  { value: 'easeOut', label: 'Ease Out' },
  { value: 'easeInOut', label: 'Ease In Out' },
  { value: 'bounce', label: 'Bounce' },
];

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  Wind, ArrowDownUp, RotateCcw, Zap, Target, Flame,
};

export default function MotionAssistDialog({ currentFrame, gridSize, onConfirm, onCancel }: MotionAssistDialogProps) {
  const templates = getAllTemplates();
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]?.id ?? '');
  const [frameCount, setFrameCount] = useState(3);
  const [intensity, setIntensity] = useState(1);
  const [easing, setEasing] = useState<EasingType>('easeInOut');
  const [previewIndex, setPreviewIndex] = useState(0);
  const [suggestions, setSuggestions] = useState<SuggestionFrame[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const config: MotionConfig = { templateId: selectedTemplate, frameCount, intensity, easing };

  // Generate suggestions when config changes
  useEffect(() => {
    const result = generateSuggestions(selectedTemplate, currentFrame, null, config, gridSize);
    setSuggestions(result);
    setPreviewIndex(0);
  }, [selectedTemplate, frameCount, intensity, easing, currentFrame, gridSize]);

  // Render preview canvas
  const renderPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = Math.floor(160 / gridSize);
    const size = gridSize * scale;
    canvas.width = size;
    canvas.height = size;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);

    // Draw checkerboard background
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#2a2a42' : '#252538';
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }

    // Draw original frame (merged layers)
    for (const layer of currentFrame.layers) {
      if (!layer.visible) continue;
      ctx.globalAlpha = layer.opacity;
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const color = layer.grid[y]?.[x];
          if (color) {
            ctx.fillStyle = color;
            ctx.fillRect(x * scale, y * scale, scale, scale);
          }
        }
      }
    }
    ctx.globalAlpha = 1;

    // Draw suggestion overlay
    const suggestion = suggestions[previewIndex];
    if (suggestion) {
      ctx.globalAlpha = suggestion.opacity;
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const color = suggestion.grid[y]?.[x];
          if (color) {
            ctx.fillStyle = suggestion.tint;
            ctx.fillRect(x * scale, y * scale, scale, scale);
          }
        }
      }
      ctx.globalAlpha = 1;
    }
  }, [currentFrame, gridSize, suggestions, previewIndex]);

  useEffect(() => {
    renderPreview();
  }, [renderPreview]);

  // Auto-cycle preview with requestAnimationFrame for smoothness
  useEffect(() => {
    if (suggestions.length <= 1) return;
    const interval = setInterval(() => {
      setPreviewIndex(prev => (prev + 1) % suggestions.length);
    }, 400);
    return () => clearInterval(interval);
  }, [suggestions.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleApply = () => {
    onConfirm(config);
  };

  const currentTemplate = templates.find((t) => t.id === selectedTemplate);

  return (
    <div className="npd-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="npd-dialog" style={{ width: 400 }}>
        <div className="npd-header">
          <span>Motion Assist</span>
          <button className="npd-close" onClick={onCancel}>×</button>
        </div>

        <div className="npd-body">
          <label style={{ fontSize: 12, opacity: 0.7, marginBottom: 4, display: 'block' }}>Template</label>
          <div className="ma-template-grid">
            {templates.map((t) => {
              const Icon = ICONS[t.icon] ?? Wind;
              return (
                <button
                  key={t.id}
                  className={`ma-template-btn ${selectedTemplate === t.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedTemplate(t.id);
                    if (t.defaultConfig.frameCount) setFrameCount(t.defaultConfig.frameCount);
                    if (t.defaultConfig.intensity) setIntensity(t.defaultConfig.intensity);
                    if (t.defaultConfig.easing) setEasing(t.defaultConfig.easing);
                  }}
                >
                  <Icon size={18} />
                  <span>{t.name}</span>
                </button>
              );
            })}
          </div>

          {currentTemplate && (
            <p className="ma-template-desc">{currentTemplate.description}</p>
          )}

          {/* Preview canvas */}
          <div className="ma-preview-wrap">
            <canvas ref={canvasRef} className="ma-preview-canvas" />
            {suggestions.length > 0 && (
              <span className="ma-preview-label">
                Preview {previewIndex + 1}/{suggestions.length}
              </span>
            )}
            {suggestions.length === 0 && (
              <span className="ma-preview-label" style={{ opacity: 0.5 }}>No preview</span>
            )}
          </div>

          <div className="ma-field">
            <label>Frames to generate</label>
            <input
              type="number"
              min={1}
              max={8}
              value={frameCount}
              onChange={(e) => setFrameCount(Math.max(1, Math.min(8, Number(e.target.value) || 1)))}
            />
          </div>

          <div className="ma-field">
            <label>Intensity: {intensity.toFixed(1)}</label>
            <input
              type="range"
              min={0.1}
              max={3}
              step={0.1}
              value={intensity}
              onChange={(e) => setIntensity(Number(e.target.value))}
            />
          </div>

          <div className="ma-field">
            <label>Easing</label>
            <select value={easing} onChange={(e) => setEasing(e.target.value as EasingType)}>
              {EASING_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="npd-footer">
          <button className="npd-btn-cancel" onClick={onCancel}>Cancel</button>
          <button className="npd-btn-create" onClick={handleApply} disabled={suggestions.length === 0}>
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}
