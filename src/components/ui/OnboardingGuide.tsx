import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Brush, Layers, Film, Keyboard, Sparkles, ChevronRight, ChevronLeft, MousePointer } from 'lucide-react';

interface OnboardingGuideProps {
  onComplete: () => void;
}

type Step = {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  tip: string | null;
  target: string | null;
  position: 'bottom' | 'right' | 'left' | 'top' | 'center';
};

const STEPS: Step[] = [
  {
    icon: Sparkles,
    title: 'Welcome to Pixly!',
    description: 'A powerful pixel art and animation editor. Let\'s take a quick tour of the main features.',
    tip: null,
    target: null,
    position: 'center',
  },
  {
    icon: Brush,
    title: 'Drawing Tools',
    description: 'All your drawing tools live here — brush, eraser, shapes, fill, eyedropper, and more. Right-click the brush for custom brushes.',
    tip: 'B for Brush, E for Eraser, G for Fill',
    target: '.sidebar',
    position: 'right',
  },
  {
    icon: MousePointer,
    title: 'Canvas',
    description: 'This is your main workspace. Zoom with Ctrl+Scroll, pan with Space+Drag. Toggle the pixel grid with the grid button.',
    tip: 'Ctrl+Scroll to zoom, Space+Drag to pan',
    target: '.main',
    position: 'left',
  },
  {
    icon: Layers,
    title: 'Layers',
    description: 'Manage your layers here. Add, delete, reorder, and toggle visibility. Each animation frame has its own set of layers.',
    tip: 'Click the eye icon to toggle visibility',
    target: '.right-sidebar',
    position: 'left',
  },
  {
    icon: Film,
    title: 'Timeline',
    description: 'Your animation timeline. Add frames, set duration, and preview. Click play to see your animation come alive.',
    tip: 'Space to play/pause',
    target: '.tl-toolbar',
    position: 'top',
  },
  {
    icon: Keyboard,
    title: 'You\'re Ready!',
    description: 'Most tools have keyboard shortcuts. Check the menu bar for more. Ctrl+Z/Y for undo/redo, Ctrl+S to save, Ctrl+Shift+E to export.',
    tip: 'Press ? to see all shortcuts',
    target: null,
    position: 'center',
  },
];

export default function OnboardingGuide({ onComplete }: OnboardingGuideProps) {
  const [step, setStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [ready, setReady] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const updatePositions = useCallback((stepIndex: number) => {
    const current = STEPS[stepIndex];
    if (!current.target) {
      setSpotlightRect(null);
      setReady(true);
      return;
    }

    const el = document.querySelector(current.target);
    if (!el) {
      setSpotlightRect(null);
      setReady(true);
      return;
    }

    const rect = el.getBoundingClientRect();
    setSpotlightRect(rect);

    // Tooltip positioning after render
    requestAnimationFrame(() => {
      const tooltip = tooltipRef.current;
      if (!tooltip) return;
      const tRect = tooltip.getBoundingClientRect();
      const gap = 16;
      let top = 0;
      let left = 0;

      switch (current.position) {
        case 'right':
          top = rect.top + rect.height / 2 - tRect.height / 2;
          left = rect.right + gap;
          break;
        case 'left':
          top = rect.top + rect.height / 2 - tRect.height / 2;
          left = rect.left - tRect.width - gap;
          break;
        case 'top':
          top = rect.top - tRect.height - gap;
          left = rect.left + rect.width / 2 - tRect.width / 2;
          break;
        case 'bottom':
          top = rect.bottom + gap;
          left = rect.left + rect.width / 2 - tRect.width / 2;
          break;
        case 'center':
        default:
          top = window.innerHeight / 2 - tRect.height / 2;
          left = window.innerWidth / 2 - tRect.width / 2;
          break;
      }

      // Clamp to viewport
      top = Math.max(16, Math.min(top, window.innerHeight - tRect.height - 16));
      left = Math.max(16, Math.min(left, window.innerWidth - tRect.width - 16));

      setTooltipPos({ top, left });
      setReady(true);
    });
  }, []);

  useEffect(() => {
    setReady(false);
    // Small delay so the previous spotlight fades out before new one appears
    const timer = setTimeout(() => updatePositions(step), 80);
    return () => clearTimeout(timer);
  }, [step, updatePositions]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleComplete();
      if (e.key === 'Enter' || e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handleBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  // Reposition on resize
  useEffect(() => {
    const onResize = () => updatePositions(step);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [step, updatePositions]);

  const handleComplete = () => {
    localStorage.setItem('pixly_onboarding_done', '1');
    onComplete();
  };

  const handleNext = () => {
    if (step === STEPS.length - 1) {
      handleComplete();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;
  const hasSpotlight = spotlightRect !== null;

  return (
    <div className="onb-overlay">
      {/* Dark backdrop */}
      <div className="onb-backdrop" onClick={handleComplete} />

      {/* Spotlight cutout */}
      {hasSpotlight && (
        <div
          className={`onb-spotlight ${ready ? 'visible' : ''}`}
          style={{
            top: spotlightRect!.top - 6,
            left: spotlightRect!.left - 6,
            width: spotlightRect!.width + 12,
            height: spotlightRect!.height + 12,
          }}
        >
          <div className="onb-spotlight-ring" />
          <div className="onb-spotlight-pulse" />
        </div>
      )}

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        className={`onb-tooltip ${hasSpotlight ? 'anchored' : 'centered'} ${ready ? 'visible' : ''}`}
        style={hasSpotlight ? { top: tooltipPos.top, left: tooltipPos.left } : undefined}
      >
        <button className="onb-close" onClick={handleComplete} title="Skip tutorial">
          <X size={14} />
        </button>

        {/* Arrow pointing to target */}
        {hasSpotlight && (
          <div className={`onb-arrow onb-arrow-${current.position}`} />
        )}

        <div className="onb-tooltip-body">
          <div className="onb-icon-wrap">
            <Icon size={24} className="onb-icon" />
          </div>

          <div className="onb-text">
            <h2 className="onb-title">{current.title}</h2>
            <p className="onb-desc">{current.description}</p>
            {current.tip && (
              <div className="onb-tip">{current.tip}</div>
            )}
          </div>
        </div>

        <div className="onb-footer">
          <div className="onb-dots">
            {STEPS.map((_, i) => (
              <div key={i} className={`onb-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`} />
            ))}
          </div>

          <div className="onb-nav">
            {step > 0 && (
              <button className="onb-btn onb-btn-back" onClick={handleBack}>
                <ChevronLeft size={14} />
                Back
              </button>
            )}
            <button className="onb-btn onb-btn-next" onClick={handleNext}>
              {isLast ? 'Get Started' : 'Next'}
              {!isLast && <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
