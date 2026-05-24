'use client';

import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Generic error boundary with retry.
 */
export default class ErrorBoundary extends Component<{ children: React.ReactNode; name?: string }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode; name?: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', this.props.name || 'Component', error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-tx-red/20 bg-tx-red/[0.06] text-center gap-3">
          <AlertTriangle className="w-8 h-8 text-tx-red" />
          <h3 className="text-base font-semibold text-tx-tp">
            {this.props.name || 'Component'} crashed
          </h3>
          <p className="text-[13px] text-tx-ts max-w-md">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-tx-red/10 border border-tx-red/20 text-tx-red text-[13px] font-medium hover:bg-tx-red/15 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
