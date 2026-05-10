import type { StateCreator } from 'zustand';

export interface UiSlice {
  showWelcome: boolean;
  showOnboarding: boolean;
  showLoading: boolean;
  showGrid: boolean;
  brushSize: number;
  onionSkinEnabled: boolean;
  animationMode: boolean;
  animationTabPinned: boolean;
  activeView: 'canvas' | 'animation';
  showNewProjectDialog: boolean;
  showBrushPopup: boolean;
  showLeftSidebar: boolean;
  showRightSidebar: boolean;
  leftSidebarWidth: number;
  rightSidebarWidth: number;
  isSpacePressed: boolean;
  pickerHoverColor: string | null;

  setShowWelcome: (v: boolean) => void;
  setShowOnboarding: (v: boolean) => void;
  setShowLoading: (v: boolean) => void;
  setShowGrid: (v: boolean) => void;
  setBrushSize: (v: number) => void;
  setOnionSkinEnabled: (v: boolean) => void;
  setAnimationMode: (v: boolean) => void;
  setAnimationTabPinned: (v: boolean) => void;
  setActiveView: (v: 'canvas' | 'animation') => void;
  setShowNewProjectDialog: (v: boolean) => void;
  setShowBrushPopup: (v: boolean) => void;
  setShowLeftSidebar: (v: boolean) => void;
  setShowRightSidebar: (v: boolean) => void;
  setLeftSidebarWidth: (v: number) => void;
  setRightSidebarWidth: (v: number) => void;
  setIsSpacePressed: (v: boolean) => void;
  setPickerHoverColor: (v: string | null) => void;
}

export const createUiSlice: StateCreator<UiSlice, [], [], UiSlice> = (set) => ({
  showWelcome: true,
  showOnboarding: localStorage.getItem('pixly_onboarding_done') !== '1',
  showLoading: false,
  showGrid: false,
  brushSize: 1,
  onionSkinEnabled: false,
  animationMode: false,
  animationTabPinned: false,
  activeView: 'canvas',
  showNewProjectDialog: false,
  showBrushPopup: false,
  showLeftSidebar: true,
  showRightSidebar: true,
  leftSidebarWidth: 100,
  rightSidebarWidth: 240,
  isSpacePressed: false,
  pickerHoverColor: null,

  setShowWelcome: (v) => set({ showWelcome: v }),
  setShowOnboarding: (v) => set({ showOnboarding: v }),
  setShowLoading: (v) => set({ showLoading: v }),
  setShowGrid: (v) => set({ showGrid: v }),
  setBrushSize: (v) => set({ brushSize: v }),
  setOnionSkinEnabled: (v) => set({ onionSkinEnabled: v }),
  setAnimationMode: (v) => set({ animationMode: v }),
  setAnimationTabPinned: (v) => set({ animationTabPinned: v }),
  setActiveView: (v) => set({ activeView: v }),
  setShowNewProjectDialog: (v) => set({ showNewProjectDialog: v }),
  setShowBrushPopup: (v) => set({ showBrushPopup: v }),
  setShowLeftSidebar: (v) => set({ showLeftSidebar: v }),
  setShowRightSidebar: (v) => set({ showRightSidebar: v }),
  setLeftSidebarWidth: (v) => set({ leftSidebarWidth: v }),
  setRightSidebarWidth: (v) => set({ rightSidebarWidth: v }),
  setIsSpacePressed: (v) => set({ isSpacePressed: v }),
  setPickerHoverColor: (v) => set({ pickerHoverColor: v }),
});
