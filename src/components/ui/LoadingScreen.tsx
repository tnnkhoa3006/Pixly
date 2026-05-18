interface LoadingScreenProps {
  status?: string;
  progress?: number | null;
}

export default function LoadingScreen({ status = 'Working...', progress = null }: LoadingScreenProps) {
  const normalizedProgress = typeof progress === 'number'
    ? Math.max(0, Math.min(100, Math.round(progress)))
    : null;

  return (
    <div className="ld-screen">
      <div className="ld-content">
        <img
          src="/Pixel It loading.gif"
          alt="Loading"
          className="ld-gif ld-gif-main"
        />
        <div className="ld-text">
          <span className="ld-brand">Pixly</span>
          <span className="ld-sub">{status}</span>
        </div>
        <div className="ld-bar-wrap">
          <div
            className={`ld-bar ${normalizedProgress === null ? 'ld-bar-indeterminate' : ''}`}
            style={normalizedProgress === null ? undefined : { width: `${normalizedProgress}%` }}
          />
        </div>
        {normalizedProgress !== null && <span className="ld-pct">{normalizedProgress}%</span>}
      </div>
    </div>
  );
}
