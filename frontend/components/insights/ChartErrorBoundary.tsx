'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ChartErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Chart Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-secondary/20 rounded-xl p-6 text-center border border-border/50">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <h3 className="text-sm font-medium text-foreground mb-1">Chart Error</h3>
          <p className="text-xs text-muted-foreground">
            Unable to display chart. Please try refreshing the page.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}