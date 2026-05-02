import { useState, useEffect } from 'react';
import { FolderOpen, Plus, MoreHorizontal } from 'lucide-react';
import type { GridSizeType, ProjectData } from '../types';
import { hasAutoSave, loadAutoSave, getRecentFiles, type RecentFile } from '../utils/autoSave';
import { openProjectFile } from '../utils/projectFile';

interface WelcomeScreenProps {
  onNewProject: (size: GridSizeType) => void;
  onLoadProject: (data: ProjectData, filePath: string) => void;
  onContinue: (data: ProjectData) => void;
}

const SIZE_PRESETS: { size: number; label: string }[] = [
  { size: 16,  label: 'Icon'   },
  { size: 32,  label: 'Small'  },
  { size: 64,  label: 'Tile'   },
  { size: 128, label: 'Sprite' },
];
const MAX_SIZE = 512;

export default function WelcomeScreen({ onNewProject, onLoadProject, onContinue }: WelcomeScreenProps) {
  const [hasAuto, setHasAuto] = useState(false);
  const [autoSaveDate, setAutoSaveDate] = useState<string | null>(null);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [customSize, setCustomSize] = useState('');
  const [customError, setCustomError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(32);

  useEffect(() => {
    (async () => {
      const has = await hasAutoSave();
      setHasAuto(has);
      if (has) {
        try {
          const data = await loadAutoSave();
          if (data?.savedAt) {
            setAutoSaveDate(new Date(data.savedAt).toLocaleString());
          }
        } catch { /* ignore */ }
      }
      setRecentFiles(getRecentFiles());
      setLoading(false);
    })();
  }, []);

  const handleContinue = async () => {
    const data = await loadAutoSave();
    if (data) onContinue(data);
  };

  const handleOpen = async () => {
    try {
      const result = await openProjectFile();
      if (result) onLoadProject(result.data, result.filePath);
    } catch (err) {
      alert(`Error opening file: ${(err as Error).message}`);
    }
  };

  const handleCustomCreate = () => {
    const val = parseInt(customSize, 10);
    if (isNaN(val) || val < 1) {
      setCustomError('Please enter a valid number');
      return;
    }
    if (val > MAX_SIZE) {
      setCustomError(`Max size is ${MAX_SIZE}×${MAX_SIZE}`);
      return;
    }
    setCustomError('');
    onNewProject(val);
  };

  const handleNewProject = () => {
    const size = selectedPreset ?? 32;
    onNewProject(size);
  };

  if (loading) {
    return (
      <div className="welcome-screen">
        <div className="welcome-loading">Loading…</div>
      </div>
    );
  }

  return (
    <div className="welcome-screen">
      <div className="welcome-layout">

        {/* ── Left hero panel ── */}
        <div className="welcome-hero">
          {/* Sparkle decorations */}
          <div className="welcome-sparkles" aria-hidden="true">
            <span className="welcome-sparkle">✦</span>
            <span className="welcome-sparkle">✧</span>
            <span className="welcome-sparkle">✦</span>
            <span className="welcome-sparkle">✧</span>
            <span className="welcome-sparkle">✦</span>
          </div>

          <div className="welcome-hero-content">
            <div className="welcome-hero-label">Welcome to</div>
            <div className="welcome-logo">Pixly</div>
            <div className="welcome-version">v0.1.0</div>
            <div className="welcome-tagline">
              Design, animate, and bring pixels to life.
            </div>
          </div>
        </div>

        {/* ── Right content panel ── */}
        <div className="welcome-card">
          <div className="welcome-card-inner">

            {/* Continue last project */}
            {hasAuto && (
              <div className="welcome-actions">
                <button className="welcome-btn welcome-btn-primary" onClick={handleContinue}>
                  <span className="welcome-btn-icon">▶</span>
                  <div className="welcome-btn-text">
                    <span className="welcome-btn-title">Continue Last Project</span>
                    {autoSaveDate && <span className="welcome-btn-sub">{autoSaveDate}</span>}
                  </div>
                </button>
              </div>
            )}

            {/* New Project */}
            <div className="welcome-section">
              <div className="welcome-section-header">
                <div className="welcome-section-title">Canvas Presets</div>
                <span className="welcome-section-action" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  Custom Size
                </span>
              </div>

              <div className="welcome-presets">
                {SIZE_PRESETS.map(({ size, label }) => (
                  <button
                    key={size}
                    className={`welcome-preset ${selectedPreset === size ? 'active' : ''}`}
                    onClick={() => setSelectedPreset(size)}
                  >
                    <span className="welcome-preset-size">{size}×{size}</span>
                    <span className="welcome-preset-label">{label}</span>
                  </button>
                ))}
                {/* Custom size preset slot */}
                <button
                  className={`welcome-preset ${selectedPreset === null ? 'active' : ''}`}
                  onClick={() => setSelectedPreset(null)}
                  title="Custom size"
                >
                  <span className="welcome-preset-size" style={{ fontSize: '18px' }}>+</span>
                  <span className="welcome-preset-label">Custom</span>
                </button>
              </div>

              {/* Custom size input — shown when Custom is selected */}
              {selectedPreset === null && (
                <div className="welcome-custom-row">
                  <input
                    type="number"
                    className="welcome-custom-input"
                    placeholder="e.g. 256"
                    min={1}
                    max={MAX_SIZE}
                    value={customSize}
                    onChange={(e) => { setCustomSize(e.target.value); setCustomError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleCustomCreate()}
                    autoFocus
                  />
                  <button className="welcome-btn-small" onClick={handleCustomCreate}>Create</button>
                </div>
              )}
              {customError && <div className="welcome-error">{customError}</div>}

              <div className="welcome-actions" style={{ marginTop: 4 }}>
                <button className="welcome-btn welcome-btn-primary" onClick={handleNewProject}>
                  <span className="welcome-btn-icon"><Plus size={14} /></span>
                  <span className="welcome-btn-title">New Project</span>
                </button>
                <button className="welcome-btn welcome-btn-secondary" onClick={handleOpen}>
                  <span className="welcome-btn-icon"><FolderOpen size={14} /></span>
                  <span className="welcome-btn-title">Open Project…</span>
                </button>
              </div>
            </div>

            {/* Recent Projects */}
            {recentFiles.length > 0 && (
              <div className="welcome-section">
                <div className="welcome-section-header">
                  <div className="welcome-section-title">Recent Projects</div>
                  {recentFiles.length > 4 && (
                    <button className="welcome-section-action">View All</button>
                  )}
                </div>
                <div className="welcome-recent-list">
                  {recentFiles.slice(0, 5).map((file, i) => (
                    <button
                      key={i}
                      className="welcome-recent-item"
                      onClick={() => {
                        (async () => {
                          try {
                            const { readTextFile } = await import('@tauri-apps/plugin-fs');
                            const { deserializeProject } = await import('../utils/projectFile');
                            const content = await readTextFile(file.filePath);
                            const data = deserializeProject(content);
                            onLoadProject(data, file.filePath);
                          } catch {
                            alert(`Could not open: ${file.name}`);
                          }
                        })();
                      }}
                    >
                      <div className="welcome-recent-thumb">🎨</div>
                      <div className="welcome-recent-info">
                        <div className="welcome-recent-name">{file.name}</div>
                        <div className="welcome-recent-meta">
                          {file.canvasSize} · {new Date(file.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                      <MoreHorizontal size={14} className="welcome-recent-more" />
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>

          <div className="welcome-footer">
            v0.1.0 · Built with ❤ and Tauri
          </div>
        </div>

      </div>
    </div>
  );
}
