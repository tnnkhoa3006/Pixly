import type { StateCreator } from 'zustand';

export interface FileSlice {
  currentFilePath: string | null;
  isDirty: boolean;
  saveConfirmTabId: string | null;

  setCurrentFilePath: (path: string | null) => void;
  setIsDirty: (dirty: boolean) => void;
  setSaveConfirmTabId: (id: string | null) => void;
}

export const createFileSlice: StateCreator<FileSlice, [], [], FileSlice> = (set) => ({
  currentFilePath: null,
  isDirty: false,
  saveConfirmTabId: null,

  setCurrentFilePath: (path) => set({ currentFilePath: path }),
  setIsDirty: (dirty) => set({ isDirty: dirty }),
  setSaveConfirmTabId: (id) => set({ saveConfirmTabId: id }),
});
