/**
 * Handles Tauri auto-update checking on launch.
 * Returns the available update (if any) and an install handler.
 */
import { useState, useEffect } from 'react';
import type { Update } from '@tauri-apps/plugin-updater';

export function useAppUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState<Update | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Only run inside Tauri
    if (!('__TAURI_INTERNALS__' in window)) return;

    const checkForUpdates = async () => {
      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const update = await check();
        if (update) setUpdateAvailable(update);
      } catch (e) {
        console.error('Failed to check for updates on launch:', e);
      }
    };

    checkForUpdates();
  }, []);

  const installUpdate = async () => {
    if (!updateAvailable) return;
    setIsUpdating(true);
    try {
      await updateAvailable.downloadAndInstall();
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (e) {
      console.error('Update failed:', e);
      setIsUpdating(false);
    }
  };

  return { updateAvailable, isUpdating, installUpdate };
}
