import { useCanvasApp } from './hooks/useCanvasApp';
import Timeline from './components/timeline/Timeline';
import AnimationView from './components/animation/AnimationView';
import WelcomeScreen from './components/ui/WelcomeScreen';
import TabBar from './components/ui/TabBar';
import NewProjectDialog from './components/ui/NewProjectDialog';
import SaveConfirmDialog from './components/ui/SaveConfirmDialog';
import OnboardingGuide from './components/ui/OnboardingGuide';
import LoadingScreen from './components/ui/LoadingScreen';
import { MenuBar } from './components/menu/MenuBar';
import LeftSidebar from './components/ui/LeftSidebar';
import RightSidebar from './components/ui/RightSidebar';
import CanvasWorkspace from './components/canvas/CanvasWorkspace';
import BottomBar from './components/ui/BottomBar';
import BrushPopup from './components/ui/BrushPopup';
import CutPopup from './components/ui/CutPopup';
import UpdateToast from './components/ui/UpdateToast';
import ExportFrameDialog from './components/ui/ExportFrameDialog';
import MotionAssistDialog from './components/ui/MotionAssistDialog';

export default function App() {
  const app = useCanvasApp();

  if (app.showWelcome) {
    return (
      <div className="app-root-container">
        <WelcomeScreen {...app.welcomeHandlers} />
      </div>
    );
  }

  const { layout: l, overlays: ov } = app;

  return (
    <div className="layout">
      <MenuBar config={l.menuConfig} actions={l.actions} title="Pixly" subtitle={`${l.titleSuffix}${l.fileName}`} />
      <TabBar {...app.tabBar} />
      {l.isPlaying && <div className="playback-badge">PLAYING</div>}

      {l.animationTabPinned && l.activeView === 'animation' && (
        <div className="animation-view">
          <AnimationView gridSize={app.animation.gridSize} isPlaying={app.animation.isPlaying} onTogglePlay={app.animation.onTogglePlay} />
        </div>
      )}

      <div className="workspace" style={{ display: l.animationTabPinned && l.activeView === 'animation' ? 'none' : 'flex' }}>
        {l.showLeftSidebar && <LeftSidebar {...app.leftSidebar} />}
        <CanvasWorkspace {...app.canvas} />
        {l.showRightSidebar && <RightSidebar {...app.rightSidebar} />}
      </div>

      {app.animation.animationMode && <Timeline {...app.timeline} />}
      <BottomBar {...app.bottomBar} />

      {app.dialogs.showNewProjectDialog && (
        <NewProjectDialog
          onConfirm={(size, name) => { app.dialogs.setShowNewProjectDialog(false); app.dialogs.addNewTab(size, name); }}
          onCancel={() => app.dialogs.setShowNewProjectDialog(false)}
        />
      )}

      {app.dialogs.saveConfirmTabId && (() => {
        const tab = app.tabBar.tabs.find(t => t.id === app.dialogs.saveConfirmTabId);
        if (!tab) return null;
        return (
          <SaveConfirmDialog
            fileName={tab.name}
            onSave={async () => {
              const tabIdToClose = app.dialogs.saveConfirmTabId!;
              app.dialogs.setSaveConfirmTabId(null);
              if (tabIdToClose === app.tabBar.activeTabId) await app.dialogs.handleSave();
              app.dialogs.performCloseTab(tabIdToClose);
            }}
            onDiscard={() => {
              const tabIdToClose = app.dialogs.saveConfirmTabId!;
              app.dialogs.setSaveConfirmTabId(null);
              app.dialogs.performCloseTab(tabIdToClose);
            }}
            onCancel={() => app.dialogs.setSaveConfirmTabId(null)}
          />
        );
      })()}

      {ov.updateAvailable && <UpdateToast updateAvailable={ov.updateAvailable} isUpdating={ov.isUpdating} updateError={ov.updateError} onInstall={ov.installUpdate} />}
      {ov.showOnboarding && <OnboardingGuide onComplete={() => ov.setShowOnboarding(false)} />}
      {ov.showLoading && <LoadingScreen onComplete={ov.onLoadingComplete} />}
      {ov.isExportingGif && (
        <div className="ld-screen" style={{ cursor: 'wait' }}>
          <div className="ld-content">
            <img src="/Pixel It loading.gif" alt="Loading" className="ld-gif ld-gif-main" />
            <div className="ld-text">
              <span className="ld-brand">Pixly</span>
              <span className="ld-sub">Exporting GIF...</span>
            </div>
            <div className="ld-bar-wrap">
              <div className="ld-bar ld-bar-indeterminate" />
            </div>
          </div>
        </div>
      )}
      {app.tabs.showBrushPopup && <BrushPopup {...app.brushPopup} />}
      {app.tabs.showCutPopup && <CutPopup {...app.cutPopup} />}
      {app.dialogs.showExportFrameDialog && (
        <ExportFrameDialog
          frames={app.dialogs.exportFrameFrames}
          activeFrameIndex={app.dialogs.exportFrameActiveIndex}
          onConfirm={app.dialogs.onExportFrameConfirm}
          onCancel={() => app.dialogs.setShowExportFrameDialog(false)}
        />
      )}
      {app.dialogs.showMotionAssistDialog && (
        <MotionAssistDialog
          currentFrame={app.dialogs.currentFrame}
          allFrames={app.dialogs.allFrames}
          activeFrameIndex={app.dialogs.activeFrameIndex}
          gridSize={app.dialogs.gridSize}
          onApplySuggestions={app.dialogs.onMotionSuggestionsApply}
          onCancel={() => app.dialogs.setShowMotionAssistDialog(false)}
        />
      )}
    </div>
  );
}
