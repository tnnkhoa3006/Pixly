import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import SplashScreen from './components/ui/SplashScreen.tsx'

const isStartupSplash = window.location.hash === '#splash';

const completeStartupSplash = async () => {
  if (!('__TAURI_INTERNALS__' in window)) return;

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('complete_splash');
  } catch (error) {
    console.error('Failed to complete splash startup:', error);
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isStartupSplash ? (
      <SplashScreen standalone onComplete={completeStartupSplash} />
    ) : (
      <App />
    )}
  </StrictMode>,
)
