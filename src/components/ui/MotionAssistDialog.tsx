import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Wind, ArrowDownUp, RotateCcw, Zap, Target, Flame,
  Eye, EyeOff, GitCompare, Wand2, Lock, Unlock, Paintbrush, Undo2,
} from 'lucide-react';
import { getAllTemplates } from '../../lib/motion/templates';
import { generateSuggestions } from '../../lib/motion/engine';
import { interpolateKeyframes } from '../../lib/motion/interpolate';
import { suggestTemplates } from '../../lib/motion/templateMatch';
import { analyzeSprite, getRegionTypeColor } from '../../lib/motion/regionDetect';
import type {
  MotionConfig, EasingType, SuggestionFrame,
  InterpolationConfig, TemplateScore, SpriteAnalysis, RegionType,
} from '../../lib/motion/types';
import type { Frame, PixelGrid } from '../../types';
import { createEmptyGrid } from '../../lib/frameHelpers';

interface MotionAssistDialogProps {
  currentFrame: Frame;
  allFrames: Frame[];
  activeFrameIndex: number;
  gridSize: number;
  onApplySuggestions: (suggestions: SuggestionFrame[], useKeyframeInterpolation: boolean) => void;
  onCancel: () => void;
}

type DialogMode = 'template' | 'keyframe';

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

const REGION_LEGEND: { type: RegionType; label: string }[] = [
  { type: 'head', label: 'Head' },
  { type: 'body', label: 'Body' },
  { type: 'arm', label: 'Arm' },
  { type: 'leg', label: 'Leg' },
  { type: 'accessory', label: 'Acc.' },
];

const PREVIEW_TARGET_SIZE = 220;

function getPreviewScale(gridSize: number): number {
  return Math.max(1, Math.floor(PREVIEW_TARGET_SIZE / Math.max(1, gridSize)));
}

function getMergedGrid(frame: Frame, gridSize: number): PixelGrid {
  const merged = createEmptyGrid(gridSize);
  for (const layer of frame.layers) {
    if (!layer.visible) continue;
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const color = layer.grid[y]?.[x];
        if (color) merged[y][x] = color;
      }
    }
  }
  return merged;
}

export default function MotionAssistDialog({
  currentFrame, allFrames, activeFrameIndex, gridSize,
  onApplySuggestions, onCancel,
}: MotionAssistDialogProps) {
  const templates = useMemo(() => getAllTemplates(), []);

  // Mode
  const [mode, setMode] = useState<DialogMode>('template');

  // Template mode state
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]?.id ?? '');
  const [frameCount, setFrameCount] = useState(3);
  const [intensity, setIntensity] = useState(1);
  const [easing, setEasing] = useState<EasingType>('easeInOut');

  // Keyframe mode state
  const [endFrameIndex, setEndFrameIndex] = useState(
    Math.min(activeFrameIndex + 1, allFrames.length - 1),
  );

  // Shared state
  const [previewIndex, setPreviewIndex] = useState(0);
  const [suggestions, setSuggestions] = useState<SuggestionFrame[]>([]);
  const [showRegions, setShowRegions] = useState(false);
  const [templateScores, setTemplateScores] = useState<TemplateScore[]>([]);
  const [isPreviewBusy, setIsPreviewBusy] = useState(false);
  const [previewStatus, setPreviewStatus] = useState('Preparing preview...');
  const [regionAnalysis, setRegionAnalysis] = useState<SpriteAnalysis | null>(null);
  const [isRegionBusy, setIsRegionBusy] = useState(false);

  // Constraint state
  const [paletteLock, setPaletteLock] = useState(true);
  const [preserveOutline, setPreserveOutline] = useState(true);
  const [maxDisplacement, setMaxDisplacement] = useState(8);

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editGrids, setEditGrids] = useState<PixelGrid[]>([]);
  const [editColor, setEditColor] = useState<string>('#000000');
  const [isPainting, setIsPainting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewJobRef = useRef(0);
  const scoreJobRef = useRef(0);
  const regionJobRef = useRef(0);

  // Auto-suggest templates when dialog opens
  useEffect(() => {
    let cancelled = false;
    const jobId = ++scoreJobRef.current;

    const timer = window.setTimeout(() => {
      const scores = suggestTemplates(currentFrame, gridSize);
      if (cancelled || scoreJobRef.current !== jobId) return;

      setTemplateScores(scores);
      if (scores.length > 0 && scores[0].score > 0.3) {
        setSelectedTemplate(scores[0].templateId);
        const bestTemplate = templates.find(t => t.id === scores[0].templateId);
        if (bestTemplate?.defaultConfig.frameCount) setFrameCount(bestTemplate.defaultConfig.frameCount);
        if (bestTemplate?.defaultConfig.intensity) setIntensity(bestTemplate.defaultConfig.intensity);
        if (bestTemplate?.defaultConfig.easing) setEasing(bestTemplate.defaultConfig.easing);
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currentFrame, gridSize, templates]);

  // Generate suggestions when config changes
  useEffect(() => {
    let cancelled = false;
    const jobId = ++previewJobRef.current;
    const busyTimer = window.setTimeout(() => {
      if (cancelled || previewJobRef.current !== jobId) return;
      setIsPreviewBusy(true);
      setPreviewStatus(mode === 'template' ? 'Generating motion preview...' : 'Interpolating keyframes...');
      setSuggestions([]);
      setEditGrids([]);
      setEditMode(false);
      setPreviewIndex(0);
    }, 0);

    const timer = window.setTimeout(() => {
      let result: SuggestionFrame[] = [];

      if (mode === 'template') {
        const config: MotionConfig = { templateId: selectedTemplate, frameCount, intensity, easing };
        result = generateSuggestions(selectedTemplate, currentFrame, null, config, gridSize);
      } else {
        const endFrame = allFrames[endFrameIndex];
        if (endFrame && endFrameIndex !== activeFrameIndex) {
          const interpConfig: Partial<InterpolationConfig> = {
            frameCount,
            easing,
            useRegionMatching: true,
            constraints: {
              paletteLock,
              gridSnap: true,
              preserveOutline,
              maxDisplacement,
            },
          };
          result = interpolateKeyframes(currentFrame, endFrame, interpConfig, gridSize);
        }
      }

      if (cancelled || previewJobRef.current !== jobId) return;
      setSuggestions(result);
      setIsPreviewBusy(false);
    }, 80);

    return () => {
      cancelled = true;
      window.clearTimeout(busyTimer);
      window.clearTimeout(timer);
    };
  }, [mode, selectedTemplate, frameCount, intensity, easing, endFrameIndex, paletteLock, preserveOutline, maxDisplacement, currentFrame, allFrames, activeFrameIndex, gridSize]);

  useEffect(() => {
    let cancelled = false;
    if (!showRegions) {
      const resetTimer = window.setTimeout(() => {
        if (cancelled) return;
        setRegionAnalysis(null);
        setIsRegionBusy(false);
      }, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(resetTimer);
      };
    }

    const jobId = ++regionJobRef.current;
    const busyTimer = window.setTimeout(() => {
      if (cancelled || regionJobRef.current !== jobId) return;
      setIsRegionBusy(true);
    }, 0);
    const timer = window.setTimeout(() => {
      const mergedGrid = getMergedGrid(currentFrame, gridSize);
      const analysis = analyzeSprite(mergedGrid, gridSize);
      if (cancelled || regionJobRef.current !== jobId) return;
      setRegionAnalysis(analysis);
      setIsRegionBusy(false);
    }, 50);

    return () => {
      cancelled = true;
      window.clearTimeout(busyTimer);
      window.clearTimeout(timer);
    };
  }, [showRegions, currentFrame, gridSize]);

  // Render preview
  const renderPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = getPreviewScale(gridSize);
    const size = gridSize * scale;
    const cssSize = Math.min(240, size);
    canvas.width = size;
    canvas.height = size;
    canvas.style.width = `${cssSize}px`;
    canvas.style.height = `${cssSize}px`;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);

    // Checkerboard
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#2a2a42' : '#252538';
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }

    // Draw original frame
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

    // Region visualization
    if (showRegions && regionAnalysis) {
      for (const region of regionAnalysis.regions) {
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = getRegionTypeColor(region.regionType);
        for (const p of region.pixels) {
          ctx.fillRect(p.x * scale, p.y * scale, scale, scale);
        }
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#fff';
        ctx.font = `${Math.max(8, scale)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(
          region.regionType[0].toUpperCase(),
          region.center.x * scale + scale / 2,
          region.center.y * scale + scale / 2 + 3,
        );
      }
      ctx.globalAlpha = 1;
    }

    // Draw suggestion (editable or original)
    const activeGrid = editMode
      ? editGrids[previewIndex]
      : suggestions[previewIndex]?.grid;

    if (activeGrid && !showRegions) {
      ctx.globalAlpha = editMode ? 0.85 : 0.5;
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const color = activeGrid[y]?.[x];
          if (color) {
            ctx.fillStyle = editMode ? color : (suggestions[previewIndex]?.tint ?? '#7c3aed');
            ctx.fillRect(x * scale, y * scale, scale, scale);
          }
        }
      }
      ctx.globalAlpha = 1;

      // Grid overlay in edit mode
      if (editMode) {
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= gridSize; i++) {
          ctx.beginPath();
          ctx.moveTo(i * scale, 0);
          ctx.lineTo(i * scale, size);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, i * scale);
          ctx.lineTo(size, i * scale);
          ctx.stroke();
        }
      }
    }
  }, [currentFrame, gridSize, suggestions, editGrids, previewIndex, showRegions, editMode, regionAnalysis]);

  useEffect(() => { renderPreview(); }, [renderPreview]);

  // Auto-cycle preview
  useEffect(() => {
    if (suggestions.length <= 1 || showRegions || editMode) return;
    const interval = setInterval(() => {
      setPreviewIndex(prev => (prev + 1) % suggestions.length);
    }, 400);
    return () => clearInterval(interval);
  }, [suggestions.length, showRegions, editMode]);

  const paintAt = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * gridSize);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * gridSize);

    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return;

    // Initialize edit grids from suggestions if needed
    if (editGrids.length === 0) {
      const grids = suggestions.map(s => s.grid.map(row => [...row]));
      setEditGrids(grids);
    }

    const grids = editGrids.length > 0
      ? editGrids
      : suggestions.map(s => s.grid.map(row => [...row]));

    const grid = grids[previewIndex];
    if (!grid) return;

    const newGrid = grid.map(row => [...row]);
    newGrid[y][x] = e.buttons === 2 ? null : editColor; // right-click = erase

    const newGrids = [...grids];
    newGrids[previewIndex] = newGrid;
    setEditGrids(newGrids);
  }, [editGrids, suggestions, previewIndex, editColor, gridSize]);

  const handleUndoEdit = useCallback(() => {
    if (editGrids.length === 0) return;
    // Reset current frame to original suggestion
    const newGrids = [...editGrids];
    newGrids[previewIndex] = suggestions[previewIndex]?.grid.map(row => [...row]) ?? newGrids[previewIndex];
    setEditGrids(newGrids);
  }, [editGrids, suggestions, previewIndex]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (editMode && e.ctrlKey && e.key === 'z') {
        handleUndoEdit();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editMode, handleUndoEdit, onCancel]);

  // Edit mode: handle canvas painting
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!editMode) return;
    setIsPainting(true);
    paintAt(e);
  }, [editMode, paintAt]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!editMode || !isPainting) return;
    paintAt(e);
  }, [editMode, isPainting, paintAt]);

  const handleCanvasMouseUp = useCallback(() => {
    setIsPainting(false);
  }, []);

  const toggleEditMode = useCallback(() => {
    if (!editMode) {
      // Entering edit mode: initialize edit grids
      const grids = suggestions.map(s => s.grid.map(row => [...row]));
      setEditGrids(grids);
    }
    setEditMode(!editMode);
  }, [editMode, suggestions]);

  const handleApply = () => {
    const gridsToApply = editGrids.length > 0
      ? editGrids.map((grid, index) => ({
        grid,
        opacity: suggestions[index]?.opacity ?? 0.5,
        tint: suggestions[index]?.tint ?? '#7c3aed',
      }))
      : suggestions;
    onApplySuggestions(gridsToApply, mode === 'keyframe');
  };

  const currentTemplate = templates.find((t) => t.id === selectedTemplate);
  const getScoreForTemplate = (id: string) => templateScores.find(s => s.templateId === id);

  return (
    <div className="npd-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="npd-dialog ma-dialog-wide">
        <div className="npd-header">
          <span>Smart Tween Engine</span>
          <button className="npd-close" onClick={onCancel}>×</button>
        </div>

        <div className="npd-body">
          {/* Mode toggle */}
          <div className="ma-mode-toggle">
            <button
              className={`ma-mode-btn ${mode === 'template' ? 'active' : ''}`}
              onClick={() => setMode('template')}
            >
              <Wand2 size={14} />
              Template
            </button>
            <button
              className={`ma-mode-btn ${mode === 'keyframe' ? 'active' : ''}`}
              onClick={() => setMode('keyframe')}
            >
              <GitCompare size={14} />
              Keyframe
            </button>
          </div>

          {/* Template mode: template grid */}
          {mode === 'template' && (
            <>
              <label style={{ fontSize: 12, opacity: 0.7, marginBottom: 4, display: 'block' }}>
                Template {templateScores.length > 0 && <span style={{ opacity: 0.5 }}>(auto-ranked)</span>}
              </label>
              <div className="ma-template-grid">
                {templates.map((t) => {
                  const Icon = ICONS[t.icon] ?? Wind;
                  const score = getScoreForTemplate(t.id);
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
                      {score && (
                        <span className="ma-score-badge" title={score.reason}>
                          {Math.round(score.score * 100)}%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {currentTemplate && (
                <p className="ma-template-desc">{currentTemplate.description}</p>
              )}
              {getScoreForTemplate(selectedTemplate) && (
                <p className="ma-template-reason">
                  {getScoreForTemplate(selectedTemplate)!.reason}
                </p>
              )}
            </>
          )}

          {/* Keyframe mode: end frame selector */}
          {mode === 'keyframe' && (
            <div className="ma-keyframe-section">
              <div className="ma-field">
                <label>Interpolate from frame {activeFrameIndex + 1} to:</label>
                <select
                  value={endFrameIndex}
                  onChange={(e) => setEndFrameIndex(Number(e.target.value))}
                >
                  {allFrames.map((f, i) => (
                    i !== activeFrameIndex && (
                      <option key={f.id} value={i}>
                        Frame {i + 1}
                      </option>
                    )
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Preview canvas */}
          <div className="ma-preview-wrap">
            <canvas
              ref={canvasRef}
              className={`ma-preview-canvas ${editMode ? 'ma-canvas-editable' : ''}`}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              onContextMenu={(e) => e.preventDefault()}
            />
            {(isPreviewBusy || isRegionBusy) && (
              <div className="ma-preview-loading">
                <div className="ma-preview-spinner" />
                <span>{isRegionBusy ? 'Analyzing regions...' : previewStatus}</span>
              </div>
            )}
            <div className="ma-preview-controls">
              {isPreviewBusy && !showRegions && (
                <span className="ma-preview-label">Preparing preview</span>
              )}
              {!isPreviewBusy && suggestions.length > 0 && !showRegions && (
                <span className="ma-preview-label">
                  {editMode ? 'Editing' : 'Preview'} {previewIndex + 1}/{suggestions.length}
                </span>
              )}
              {showRegions && (
                <span className="ma-preview-label">Region Analysis</span>
              )}
              {!isPreviewBusy && suggestions.length === 0 && !showRegions && (
                <span className="ma-preview-label" style={{ opacity: 0.5 }}>No preview</span>
              )}

              <div className="ma-preview-btns">
                <button
                  className="ma-region-toggle"
                  onClick={() => setShowRegions(!showRegions)}
                  disabled={isPreviewBusy || isRegionBusy}
                  title={showRegions ? 'Show motion preview' : 'Show detected regions'}
                >
                  {showRegions ? <Eye size={14} /> : <EyeOff size={14} />}
                  <span>{showRegions ? 'Motion' : 'Regions'}</span>
                </button>

                {suggestions.length > 0 && (
                  <button
                    className={`ma-region-toggle ${editMode ? 'ma-edit-active' : ''}`}
                    onClick={toggleEditMode}
                    disabled={isPreviewBusy}
                    title={editMode ? 'Exit edit mode' : 'Edit suggestion'}
                  >
                    <Paintbrush size={14} />
                    <span>{editMode ? 'Done' : 'Edit'}</span>
                  </button>
                )}

                {editMode && (
                  <button
                    className="ma-region-toggle"
                    onClick={handleUndoEdit}
                    title="Undo edit on current frame"
                  >
                    <Undo2 size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Edit mode: color picker */}
          {editMode && (
            <div className="ma-edit-bar">
              <label style={{ fontSize: 12, opacity: 0.7 }}>Paint color:</label>
              <input
                type="color"
                value={editColor}
                onChange={(e) => setEditColor(e.target.value)}
                className="ma-edit-color"
              />
              <span style={{ fontSize: 11, opacity: 0.5 }}>Left-click = paint, Right-click = erase</span>
            </div>
          )}

          {/* Region legend */}
          {showRegions && (
            <div className="ma-region-legend">
              {REGION_LEGEND.map(({ type, label }) => (
                <span key={type} className="ma-region-legend-item">
                  <span
                    className="ma-region-legend-dot"
                    style={{ background: getRegionTypeColor(type) }}
                  />
                  {label}
                </span>
              ))}
            </div>
          )}

          {/* Controls */}
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

          {mode === 'template' && (
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
          )}

          <div className="ma-field">
            <label>Easing</label>
            <select value={easing} onChange={(e) => setEasing(e.target.value as EasingType)}>
              {EASING_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Constraint toggles (keyframe mode) */}
          {mode === 'keyframe' && (
            <div className="ma-constraints">
              <label style={{ fontSize: 12, opacity: 0.7, marginBottom: 4, display: 'block' }}>Constraints</label>
              <label className="ma-checkbox">
                <input
                  type="checkbox"
                  checked={paletteLock}
                  onChange={(e) => setPaletteLock(e.target.checked)}
                />
                {paletteLock ? <Lock size={12} /> : <Unlock size={12} />}
                Palette lock
              </label>
              <label className="ma-checkbox">
                <input
                  type="checkbox"
                  checked={preserveOutline}
                  onChange={(e) => setPreserveOutline(e.target.checked)}
                />
                Preserve outline
              </label>
              <div className="ma-field" style={{ marginTop: 4 }}>
                <label>Max displacement: {maxDisplacement}px</label>
                <input
                  type="range"
                  min={2}
                  max={20}
                  step={1}
                  value={maxDisplacement}
                  onChange={(e) => setMaxDisplacement(Number(e.target.value))}
                />
              </div>
            </div>
          )}
        </div>

        <div className="npd-footer">
          <button className="npd-btn-cancel" onClick={onCancel}>Cancel</button>
          <button
            className="npd-btn-create"
            onClick={handleApply}
            disabled={isPreviewBusy || isRegionBusy || suggestions.length === 0}
          >
            {editMode ? 'Apply Edits' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}
