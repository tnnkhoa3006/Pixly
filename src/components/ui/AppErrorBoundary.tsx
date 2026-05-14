import { Component, type ErrorInfo, type ReactNode } from 'react';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  message: string | null;
};

export default class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: null,
  };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Unexpected UI error',
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Pixly UI error:', error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, message: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="app-error-screen">
        <div className="app-error-panel">
          <div className="app-error-title">Pixly recovered from a UI error</div>
          <div className="app-error-message">
            Your autosave is kept separately. Reload Pixly and use Continue if the workspace does not reopen cleanly.
          </div>
          {this.state.message && <code className="app-error-code">{this.state.message}</code>}
          <div className="app-error-actions">
            <button type="button" className="app-error-btn app-error-btn-primary" onClick={this.handleRetry}>
              Try Again
            </button>
            <button type="button" className="app-error-btn" onClick={this.handleReload}>
              Reload Pixly
            </button>
          </div>
        </div>
      </div>
    );
  }
}
