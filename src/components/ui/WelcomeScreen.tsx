import { useEffect, useState, useCallback } from 'react';
import { FolderOpen, Film, MoreHorizontal, Play, Grid3X3, Sparkles, Clock, FileImage, Info, ExternalLink, Paintbrush } from 'lucide-react';
import { APP_DISPLAY_VERSION, APP_NAME } from '../../constants/appInfo';
import type { GridSizeType } from '../../types';
import { getRecentFiles, hasAutoSave, loadAutoSave, type RecentFile } from '../../lib/autoSave';

interface WelcomeScreenProps {
  onNewProject: (size: GridSizeType) => void;
  onNewAnimation: (size: GridSizeType) => void;
  onOpenProject: () => void;
  onOpenRecentProject: (file: RecentFile) => void;
  onContinue: () => void;
}

const SIZE_PRESETS: { size: number; label: string }[] = [
  { size: 16, label: '16' },
  { size: 32, label: '32' },
  { size: 64, label: '64' },
  { size: 128, label: '128' },
];
const MAX_SIZE = 1024;
const MAX_AREA = 1024 * 1024;

export default function WelcomeScreen({ onNewProject, onNewAnimation, onOpenProject, onOpenRecentProject, onContinue }: WelcomeScreenProps) {
  const [hasAuto, setHasAuto] = useState(false);
  const [autoSaveDate, setAutoSaveDate] = useState<string | null>(null);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState(32);
  const [isCustom, setIsCustom] = useState(false);
  const [customWidth, setCustomWidth] = useState('200');
  const [customHeight, setCustomHeight] = useState('300');
  const [customError, setCustomError] = useState('');

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
        } catch {
          // Ignore autosave read errors on the welcome screen.
        }
      }
      setRecentFiles(getRecentFiles());
      setLoading(false);
    })();
  }, []);

  const handleOpen = useCallback(async () => {
    onOpenProject();
  }, [onOpenProject]);

  const getGridSize = (): GridSizeType | null => {
    if (!isCustom) return selectedPreset;

    const width = parseInt(customWidth, 10);
    const height = parseInt(customHeight, 10);
    if (isNaN(width) || isNaN(height) || width < 1 || height < 1) {
      setCustomError('Enter a valid width and height');
      return null;
    }
    if (width > MAX_SIZE || height > MAX_SIZE) {
      setCustomError(`Max side is ${MAX_SIZE}px`);
      return null;
    }
    if (width * height > MAX_AREA) {
      setCustomError(`Max canvas area is ${MAX_AREA.toLocaleString()} pixels`);
      return null;
    }
    setCustomError('');
    return { width, height };
  };

  const handleNewProject = useCallback(() => {
    const size = getGridSize();
    if (size) onNewProject(size);
  }, [isCustom, customWidth, customHeight, selectedPreset, onNewProject]);

  const handleNewAnimation = useCallback(() => {
    const size = getGridSize();
    if (size) onNewAnimation(size);
  }, [isCustom, customWidth, customHeight, selectedPreset, onNewAnimation]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT') return;
        handleNewProject();
      }
      if (e.key === 'o' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleOpen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNewProject, handleOpen]);

  if (loading) {
    return (
      <div className="welcome-screen">
        <div className="welcome-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="welcome-screen">
      <div className="welcome-layout">
        <div className="welcome-sidebar">
          <div className="welcome-sidebar-top">
            {hasAuto && (
              <button className="welcome-sidebar-btn welcome-sidebar-btn-accent" onClick={onContinue}>
                <Play size={14} className="welcome-sidebar-icon" />
                <span className="welcome-sidebar-label">
                  Continue
                  {autoSaveDate && <span className="welcome-sidebar-date">{autoSaveDate}</span>}
                </span>
              </button>
            )}

            <button className="welcome-sidebar-btn" onClick={handleNewProject}>
              <Paintbrush size={14} className="welcome-sidebar-icon" />
              <span className="welcome-sidebar-label">New Sprite</span>
            </button>

            <button className="welcome-sidebar-btn" onClick={handleNewAnimation}>
              <Film size={14} className="welcome-sidebar-icon" />
              <span className="welcome-sidebar-label">New Animation</span>
            </button>

            <div className="welcome-sidebar-separator" />

            <button className="welcome-sidebar-btn" onClick={handleOpen}>
              <FolderOpen size={14} className="welcome-sidebar-icon" />
              <span className="welcome-sidebar-label">Open File</span>
              <span className="welcome-sidebar-hint">Ctrl+O</span>
            </button>
          </div>

          <div className="welcome-sidebar-bottom">
            <div className="welcome-sidebar-separator" />
            <a
              className="welcome-sidebar-btn welcome-sidebar-link"
              href="https://pixly-lovat.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Info size={14} className="welcome-sidebar-icon" />
              <span className="welcome-sidebar-label">About</span>
              <ExternalLink size={10} className="welcome-sidebar-external" />
            </a>
          </div>
        </div>

        <div className="welcome-center">
          <div className="welcome-center-brand">
            <img src="/pixly-icon.png" alt="Pixly" className="welcome-center-logo" />
            <div className="welcome-center-name">
              {APP_NAME} <span className="welcome-center-version">{APP_DISPLAY_VERSION}</span>
            </div>
          </div>

          <p className="welcome-center-tagline">
            <Sparkles size={14} className="welcome-tagline-icon" />
            Pixel art & animation, simplified.
          </p>

          <div className="welcome-presets">
            {SIZE_PRESETS.map(({ size, label }) => (
              <button
                key={size}
                className={`welcome-preset ${!isCustom && selectedPreset === size ? 'active' : ''}`}
                onClick={() => { setSelectedPreset(size); setIsCustom(false); setCustomError(''); }}
              >
                {label}
              </button>
            ))}
            <button
              className={`welcome-preset ${isCustom ? 'active' : ''}`}
              onClick={() => setIsCustom(true)}
              title="Custom size"
            >
              <Grid3X3 size={12} />
            </button>
          </div>

          {isCustom && (
            <div className="welcome-custom-size">
              <input
                type="number"
                className="welcome-custom-input"
                value={customWidth}
                onChange={(e) => { setCustomWidth(e.target.value); setCustomError(''); }}
                min={1}
                max={MAX_SIZE}
                placeholder="W"
              />
              <span className="welcome-custom-label">x</span>
              <input
                type="number"
                className="welcome-custom-input"
                value={customHeight}
                onChange={(e) => { setCustomHeight(e.target.value); setCustomError(''); }}
                min={1}
                max={MAX_SIZE}
                placeholder="H"
              />
              <span className="welcome-custom-label">px</span>
              {customError && <span className="welcome-custom-error">{customError}</span>}
            </div>
          )}

          <div className="welcome-center-actions">
            <button className="welcome-center-btn" onClick={handleNewProject}>
              <Paintbrush size={16} /> New Sprite
            </button>
            <button className="welcome-center-btn welcome-center-btn-secondary" onClick={handleNewAnimation}>
              <Film size={16} /> New Animation
            </button>
          </div>
        </div>

        <div className="welcome-recent">
          <div className="welcome-recent-header">
            <Clock size={12} />
            Recent Projects
          </div>
          {recentFiles.length === 0 ? (
            <div className="welcome-recent-empty">
              <FileImage size={32} className="welcome-recent-empty-icon" />
              <span>No recent projects</span>
              <span className="welcome-recent-empty-hint">Create or open a file to get started</span>
            </div>
          ) : (
            <div className="welcome-recent-list">
              {recentFiles.slice(0, 8).map((file, i) => (
                <button
                  key={i}
                  className="welcome-recent-item"
                  onClick={() => onOpenRecentProject(file)}
                >
                  <div className="welcome-recent-thumb">
                    <FileImage size={14} />
                  </div>
                  <div className="welcome-recent-info">
                    <div className="welcome-recent-name">{file.name}</div>
                    <div className="welcome-recent-meta">
                      {file.canvasSize} - {new Date(file.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                  <MoreHorizontal size={14} className="welcome-recent-more" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="welcome-footer">
        <span>{APP_DISPLAY_VERSION} - Built with Tauri</span>
        <span className="welcome-footer-hint">Press Enter to create - Ctrl+O to open</span>
      </div>
    </div>
  );
}
