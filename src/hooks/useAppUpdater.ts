/**
 * Handles Tauri auto-update checking on launch.
 * Returns the available update (if any) and an install handler.
 */
import { useState, useEffect } from 'react';
import type { Update } from '@tauri-apps/plugin-updater';

type UpdateErrorSource = 'check' | 'install';

export function useAppUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState<Update | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

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

  const messageFromError = (source: UpdateErrorSource, error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    const prefix = source === 'check' ? 'Failed to check for updates' : 'Failed to install update';
    return `${prefix}: ${message}`;
  };

  const checkForUpdate = async () => {
    if (!('__TAURI_INTERNALS__' in window)) {
      throw new Error('Updates are only supported in the desktop app.');
    }

    setUpdateError(null);
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      setUpdateAvailable(update);
      return update;
    } catch (error) {
      const message = messageFromError('check', error);
      setUpdateError(message);
      throw new Error(message);
    }
  };

  const installUpdate = async () => {
    if (!updateAvailable) return;
    setIsUpdating(true);
    setUpdateError(null);
    try {
      await updateAvailable.downloadAndInstall();
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (error) {
      const message = messageFromError('install', error);
      console.error(message, error);
      setUpdateError(message);
      setIsUpdating(false);
      throw new Error(message);
    }
  };

  return { updateAvailable, isUpdating, updateError, checkForUpdate, installUpdate };
}
