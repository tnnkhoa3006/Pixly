import { useEffect } from 'react';
import { Save, X } from 'lucide-react';

interface SaveConfirmDialogProps {
  fileName: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export default function SaveConfirmDialog({ fileName, onSave, onDiscard, onCancel }: SaveConfirmDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="npd-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="npd-dialog save-confirm-dialog">
        {/* Header */}
        <div className="npd-header">
          <span className="npd-title">Save Changes?</span>
          <button className="npd-close" onClick={onCancel} title="Cancel">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="npd-body">
          <p className="save-confirm-message">
            Do you want to save changes to <strong>{fileName}</strong>?
          </p>
        </div>

        {/* Footer */}
        <div className="npd-footer">
          <button className="npd-btn-cancel" onClick={onCancel}>Cancel</button>
          <button className="save-confirm-btn-discard" onClick={onDiscard}>Don't Save</button>
          <button className="npd-btn-create" onClick={onSave}>
            <Save size={13} />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
