import { memo } from 'react';

interface UpdateInfo {
  version: string;
}

interface UpdateToastProps {
  updateAvailable: UpdateInfo;
  isUpdating: boolean;
  updateError: string | null;
  onInstall: () => Promise<void>;
}

export default memo(function UpdateToast({ updateAvailable, isUpdating, updateError, onInstall }: UpdateToastProps) {
  return (
    <div className="update-toast">
      <div className="update-toast-content">
        <h4>Update Available!</h4>
        <p>Pixly v{updateAvailable.version} is ready to install.</p>
      </div>
      <div className="update-toast-actions">
        <button
          className="update-btn-primary"
          disabled={isUpdating}
          onClick={() => {
            onInstall().catch((error) => {
              const message = error instanceof Error ? error.message : String(error);
              window.alert(message);
            });
          }}
        >
          {isUpdating ? 'Installing...' : 'Update & Relaunch'}
        </button>
        <button className="update-btn-secondary" disabled={isUpdating}>
          Later
        </button>
      </div>
      {updateError && <p className="update-toast-error">{updateError}</p>}
    </div>
  );
});
