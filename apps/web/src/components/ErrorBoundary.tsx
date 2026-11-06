import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[dayline] render error', error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash-screen">
        <div className="brand-mark large">D</div>
        <h1>页面遇到了一点问题</h1>
        <p>数据仍然保存在本地 SQLite 中，刷新通常可以恢复。</p>
        <pre>{this.state.error.message}</pre>
        <div className="button-row">
          <button className="button primary" onClick={() => window.location.reload()}>
            重新加载
          </button>
          <button
            className="button ghost"
            onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.set('reset', '1');
              window.location.href = url.toString();
            }}
          >
            清空示例数据并重置（开发）
          </button>
        </div>
      </div>
    );
  }
}
