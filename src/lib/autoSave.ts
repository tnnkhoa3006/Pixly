/**
 * Auto-save system using Tauri appDataDir.
 * Uses double-file strategy to prevent corruption.
 * Falls back to localStorage when running in browser dev mode.
 */
import type { AnimationState, ProjectData, ToolType } from '../types';
import { serializeProject, deserializeProject } from './projectFile';

const AUTOSAVE_KEY = 'pixly_autosave';
const AUTOSAVE_A = 'pixly_autosave_a.json';
const AUTOSAVE_B = 'pixly_autosave_b.json';
const AUTOSAVE_META = 'pixly_autosave_meta.json';
const RECENT_FILES_KEY = 'pixly_recent_files';

const isTauri = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// ---------- Tauri appDataDir helpers ----------

async function getAutoSaveDir(): Promise<string> {
  const { appDataDir } = await import('@tauri-apps/api/path');
  return await appDataDir();
}

async function ensureDir(dir: string) {
  const { exists, mkdir } = await import('@tauri-apps/plugin-fs');
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
}

async function getAutoSavePaths() {
  const { join } = await import('@tauri-apps/api/path');
  const dir = await getAutoSaveDir();
  return {
    dir,
    slotA: await join(dir, AUTOSAVE_A),
    slotB: await join(dir, AUTOSAVE_B),
    meta: await join(dir, AUTOSAVE_META),
  };
}

// ---------- Auto-save (Tauri: double-file, Web: localStorage) ----------

export async function autoSaveProject(
  gridSize: number,
  gridHeight: number,
  animState: AnimationState,
  currentColor: string,
  currentTool: ToolType,
): Promise<void> {
  const content = serializeProject(gridSize, gridHeight, animState, currentColor, currentTool, false);

  if (isTauri()) {
    try {
      const { writeTextFile, readTextFile, exists } = await import('@tauri-apps/plugin-fs');
      const paths = await getAutoSavePaths();
      await ensureDir(paths.dir);

      let lastSlot: 'a' | 'b' = 'a';
      try {
        if (await exists(paths.meta)) {
          const meta = JSON.parse(await readTextFile(paths.meta));
          lastSlot = meta.lastSlot === 'a' ? 'a' : 'b';
        }
      } catch { /* ignore corrupt meta */ }

      const writeSlot = lastSlot === 'a' ? 'b' : 'a';
      const writePath = writeSlot === 'a' ? paths.slotA : paths.slotB;
      await writeTextFile(writePath, content);

      await writeTextFile(paths.meta, JSON.stringify({ lastSlot: writeSlot, timestamp: Date.now() }));
    } catch (err) {
      console.error('Tauri auto-save failed:', err);
    }
  } else {
    try {
      localStorage.setItem(AUTOSAVE_KEY, content);
    } catch (err) {
      console.error('localStorage auto-save failed:', err);
    }
  }
}

export async function loadAutoSave(): Promise<ProjectData | null> {
  if (isTauri()) {
    try {
      const { readTextFile, exists } = await import('@tauri-apps/plugin-fs');
      const paths = await getAutoSavePaths();

      if (!(await exists(paths.meta))) return null;

      const meta = JSON.parse(await readTextFile(paths.meta));
      const primarySlot = meta.lastSlot === 'a' ? paths.slotA : paths.slotB;
      const fallbackSlot = meta.lastSlot === 'a' ? paths.slotB : paths.slotA;

      for (const path of [primarySlot, fallbackSlot]) {
        try {
          if (await exists(path)) {
            const content = await readTextFile(path);
            return deserializeProject(content);
          }
        } catch { /* try next slot */ }
      }
    } catch (err) {
      console.error('Tauri auto-save load failed:', err);
    }
  } else {
    try {
      const content = localStorage.getItem(AUTOSAVE_KEY);
      if (content) return deserializeProject(content);
    } catch { /* ignore */ }
  }
  return null;
}

export async function hasAutoSave(): Promise<boolean> {
  if (isTauri()) {
    try {
      const { exists } = await import('@tauri-apps/plugin-fs');
      const paths = await getAutoSavePaths();
      return await exists(paths.meta);
    } catch { return false; }
  } else {
    return !!localStorage.getItem(AUTOSAVE_KEY);
  }
}

export async function clearAutoSave(): Promise<void> {
  if (isTauri()) {
    try {
      const { remove, exists } = await import('@tauri-apps/plugin-fs');
      const paths = await getAutoSavePaths();
      for (const path of [paths.slotA, paths.slotB, paths.meta]) {
        if (await exists(path)) await remove(path);
      }
    } catch { /* ignore */ }
  } else {
    localStorage.removeItem(AUTOSAVE_KEY);
  }
}

// ---------- Recent Files ----------

export type RecentFile = {
  filePath: string;
  name: string;
  timestamp: string;
  canvasSize: string;
};

export function getRecentFiles(): RecentFile[] {
  try {
    const raw = localStorage.getItem(RECENT_FILES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

export function addRecentFile(filePath: string, gridSize: number, gridHeight: number = gridSize): void {
  const recent = getRecentFiles().filter(r => r.filePath !== filePath);
  const name = filePath.split(/[/\\]/).pop() || filePath;
  recent.unshift({
    filePath,
    name,
    timestamp: new Date().toISOString(),
    canvasSize: `${gridSize}x${gridHeight}`,
  });
  if (recent.length > 10) recent.length = 10;
  localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(recent));
}
