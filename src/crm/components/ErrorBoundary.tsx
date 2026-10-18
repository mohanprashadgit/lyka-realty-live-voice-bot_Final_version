import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Uncaught UI Error Caught by ErrorBoundary]:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    localStorage.removeItem('lyka_employee');
    window.location.hash = '';
    window.location.reload();
  };

  private handleClearAllAndLogin = () => {
    localStorage.removeItem('lyka_auth_token');
    localStorage.removeItem('lyka_employee');
    window.location.hash = '';
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#0B0A0C] text-[#e6e1e5] flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full rounded-2xl bg-[#141217] border border-[#28232D] p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Something went wrong</h2>
              <p className="text-xs text-[#968a7e] mt-1 break-words">
                {this.state.error?.message || 'An unexpected rendering error occurred.'}
              </p>
            </div>
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 rounded-xl border border-[#28232D] bg-[#18161B] hover:bg-[#201e25] text-xs font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Home className="w-3.5 h-3.5 text-[#d8a868]" />
                Go to Welcome
              </button>
              <button
                onClick={this.handleClearAllAndLogin}
                className="px-4 py-2 rounded-xl bg-[#d8a868] hover:bg-[#f0be7c] text-xs font-bold text-[#0B0A0C] transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Staff Sign In
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
