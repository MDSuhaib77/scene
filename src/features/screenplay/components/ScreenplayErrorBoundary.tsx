import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, FileText } from 'lucide-react';

interface Props {
  children: ReactNode;
  onResetToBlank?: () => void;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ScreenplayErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ScreenplayErrorBoundary] Caught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onResetToBlank) {
      this.props.onResetToBlank();
    } else {
      window.location.reload();
    }
  };

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          data-testid="screenplay-error-boundary-fallback"
          className="w-full h-full min-h-[500px] flex items-center justify-center bg-[#0e1017] p-8 text-stone-200"
        >
          <div className="max-w-md w-full bg-[#181a24] border border-violet-500/30 rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-violet-400">
              <div className="w-10 h-10 rounded-lg bg-violet-500/15 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">
                  {this.props.fallbackTitle || 'Screenplay Display Error'}
                </h3>
                <p className="text-xs text-stone-400">
                  The writing workspace encountered an unexpected rendering issue.
                </p>
              </div>
            </div>

            {this.state.error && (
              <div className="p-3 bg-black/40 border border-white/5 rounded text-xs font-mono text-red-300 break-words max-h-32 overflow-y-auto">
                {this.state.error.message || 'Unknown error'}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 text-stone-300 flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <FileText className="w-3.5 h-3.5" />
                Reset to Blank Draft
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
