interface SplashScreenProps {
  standalone?: boolean;
}

export default function SplashScreen({ standalone = false }: SplashScreenProps) {
  return (
    <div className={`sp-screen ${standalone ? 'sp-standalone' : ''}`}>
      <div className="sp-window">
        {/* Left panel - Pokemon GIF */}
        <div className="sp-left">
          <img
            src="/pokemon  pixel art.gif"
            alt="Pixel art"
            className="sp-gif"
          />
        </div>

        {/* Right panel - Loading info */}
        <div className="sp-right">
          <img
            src="/Pixel It loading.gif"
            alt="Loading"
            className="sp-gif sp-gif-sm"
          />
          <div className="sp-text">
            <span className="sp-brand">Pixly</span>
            <span className="sp-sub">Pixel Art Editor</span>
          </div>
          <div className="sp-bar-wrap">
            <div className="sp-bar sp-bar-indeterminate" />
          </div>
          <span className="sp-pct">Starting...</span>
        </div>
      </div>
    </div>
  );
}
