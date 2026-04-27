import { useState, useEffect } from 'react';
import type { GridSizeType, ProjectData } from '../types';
import { hasAutoSave, loadAutoSave, getRecentFiles, type RecentFile } from '../utils/autoSave';
import { openProjectFile } from '../utils/projectFile';

interface WelcomeScreenProps {
  onNewProject: (size: GridSizeType) => void;
  onLoadProject: (data: ProjectData, filePath: string) => void;
  onContinue: (data: ProjectData) => void;
}

const SIZE_PRESETS = [16, 32, 64, 128];
const MAX_SIZE = 512;

export default function WelcomeScreen({ onNewProject, onLoadProject, onContinue }: WelcomeScreenProps) {
  const [hasAuto, setHasAuto] = useState(false);
  const [autoSaveDate, setAutoSaveDate] = useState<string | null>(null);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [customSize, setCustomSize] = useState('');
  const [customError, setCustomError] = useState('');
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="welcome-screen">
        <div className="welcome-loading">Loading…</div>
      </div>
    );
  }

  return (
    <div className="welcome-screen">
      <div className="welcome-card">
        {/* Header */}
        <div className="welcome-header">
          <div className="welcome-logo">Pixly</div>
          <div className="welcome-tagline">Professional Pixel Art Editor</div>
        </div>

        {/* Continue */}
        {hasAuto && (
          <div className="welcome-section">
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
          <div className="welcome-section-title">New Project</div>
          <div className="welcome-presets">
            {SIZE_PRESETS.map(size => (
              <button key={size} className="welcome-preset" onClick={() => onNewProject(size)}>
                <span className="welcome-preset-size">{size}×{size}</span>
              </button>
            ))}
          </div>
          <div className="welcome-custom-row">
            <input
              type="number"
              className="welcome-custom-input"
              placeholder="Custom size…"
              min={1}
              max={MAX_SIZE}
              value={customSize}
              onChange={(e) => { setCustomSize(e.target.value); setCustomError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleCustomCreate()}
            />
            <button className="welcome-btn welcome-btn-small" onClick={handleCustomCreate}>Create</button>
          </div>
          {customError && <div className="welcome-error">{customError}</div>}
        </div>

        {/* Open File */}
        <div className="welcome-section">
          <button className="welcome-btn welcome-btn-secondary" onClick={handleOpen}>
            <span className="welcome-btn-icon">📂</span>
            <span className="welcome-btn-title">Open File (.pixly)</span>
          </button>
        </div>

        {/* Recent Files */}
        {recentFiles.length > 0 && (
          <div className="welcome-section">
            <div className="welcome-section-title">Recent Files</div>
            <div className="welcome-recent-list">
              {recentFiles.map((file, i) => (
                <button
                  key={i}
                  className="welcome-recent-item"
                  onClick={() => {
                    // In Tauri, re-open from file path
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
                  <div className="welcome-recent-name">{file.name}</div>
                  <div className="welcome-recent-meta">
                    {file.canvasSize} · {new Date(file.timestamp).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="welcome-footer">
          v0.1.0 · Built with ❤ and Tauri
        </div>
      </div>
    </div>
  );
}
