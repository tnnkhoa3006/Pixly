/**
 * Project file I/O for .pixly format.
 * Uses Tauri native APIs when available, falls back to web APIs for dev mode.
 */
import type { AnimationState, ProjectData, ToolType } from '../types';

const FILE_VERSION = 1;
const PIXLY_FILTER = { name: 'Pixly Project', extensions: ['pixly'] };

// ---------- Tauri detection ----------

const isTauri = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// ---------- Serialize / Deserialize ----------

export function serializeProject(
  gridSize: number,
  gridHeight: number,
  animState: AnimationState,
  currentColor: string,
  currentTool: ToolType,
  pretty = true,
): string {
  const data: ProjectData = {
    version: FILE_VERSION,
    canvas: { width: gridSize, height: gridHeight },
    animState,
    currentColor,
    currentTool,
    savedAt: new Date().toISOString(),
  };
  return JSON.stringify(data, null, pretty ? 2 : 0);
}

export function deserializeProject(json: string): ProjectData {
  const data = JSON.parse(json);
  if (!data || typeof data !== 'object') throw new Error('Invalid project file');
  if (data.version !== FILE_VERSION) {
    throw new Error(`Unsupported file version: ${data.version}. Expected ${FILE_VERSION}`);
  }
  if (!data.canvas || !data.animState || !data.animState.frames) {
    throw new Error('Corrupted project file: missing required fields');
  }
  return data as ProjectData;
}

// ---------- Save ----------

export async function saveProjectAs(
  gridSize: number,
  gridHeight: number,
  animState: AnimationState,
  currentColor: string,
  currentTool: ToolType,
): Promise<string | null> {
  const content = serializeProject(gridSize, gridHeight, animState, currentColor, currentTool);

  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    const filePath = await save({
      title: 'Save Project As',
      filters: [PIXLY_FILTER],
      defaultPath: 'untitled.pixly',
    });
    if (!filePath) return null;
    const path = filePath.endsWith('.pixly') ? filePath : filePath + '.pixly';
    await writeTextFile(path, content);
    return path;
  } else {
    // Web fallback
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'untitled.pixly';
    a.click();
    URL.revokeObjectURL(url);
    return 'web-download';
  }
}

export async function saveProjectToPath(
  filePath: string,
  gridSize: number,
  gridHeight: number,
  animState: AnimationState,
  currentColor: string,
  currentTool: ToolType,
): Promise<void> {
  const content = serializeProject(gridSize, gridHeight, animState, currentColor, currentTool);
  if (isTauri()) {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    await writeTextFile(filePath, content);
  }
}

// ---------- Open ----------

export async function selectProjectFilePath(): Promise<string | null> {
  if (!isTauri()) return null;

  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({
    title: 'Open Project',
    multiple: false,
    filters: [PIXLY_FILTER],
  });
  if (!selected) return null;
  return typeof selected === 'string' ? selected : selected as unknown as string;
}

export async function readProjectFileFromPath(filePath: string): Promise<{ data: ProjectData; filePath: string }> {
  if (!isTauri()) {
    throw new Error('Opening recent file paths is only supported in the desktop app.');
  }

  const { readTextFile } = await import('@tauri-apps/plugin-fs');
  const content = await readTextFile(filePath);
  return { data: deserializeProject(content), filePath };
}

export async function openProjectFile(): Promise<{ data: ProjectData; filePath: string } | null> {
  if (isTauri()) {
    const filePath = await selectProjectFilePath();
    if (!filePath) return null;
    return readProjectFileFromPath(filePath);
  } else {
    // Web fallback
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pixly';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) { resolve(null); return; }
        const text = await file.text();
        try {
          const data = deserializeProject(text);
          resolve({ data, filePath: file.name });
        } catch (err) {
          alert(`Failed to open file: ${(err as Error).message}`);
          resolve(null);
        }
      };
      input.click();
    });
  }
}
