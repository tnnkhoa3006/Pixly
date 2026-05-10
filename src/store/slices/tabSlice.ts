import type { StateCreator } from 'zustand';
import type { TabState } from '../../types';

export interface TabSlice {
  tabs: TabState[];
  activeTabId: string;

  setTabs: (tabs: TabState[] | ((prev: TabState[]) => TabState[])) => void;
  setActiveTabId: (id: string) => void;
}

export const createTabSlice: StateCreator<TabSlice, [], [], TabSlice> = (set) => ({
  tabs: [],
  activeTabId: '',

  setTabs: (tabs) => set(prev => ({
    tabs: typeof tabs === 'function' ? tabs(prev.tabs) : tabs,
  })),
  setActiveTabId: (id) => set({ activeTabId: id }),
});
