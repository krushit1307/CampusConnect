import React, { Component, ErrorInfo, ReactNode } from "react";
import { WidgetErrorFallback } from "./WidgetErrorFallback";

export interface WidgetErrorBoundaryProps {
  title?: string;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onReset?: () => void;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  maxRetries?: number;
  children: ReactNode;
  className?: string;
}

export interface WidgetErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

/**
 * Class-based Error Boundary for localized component/widget isolation (#1737).
 * Catches JavaScript errors in child components without crashing the rest of the application.
 */
export class WidgetErrorBoundary extends Component<
  WidgetErrorBoundaryProps,
  WidgetErrorBoundaryState
> {
  public state: WidgetErrorBoundaryState = {
    hasError: false,
    error: null,
    retryCount: 0,
  };

  public static defaultProps = {
    maxRetries: 3,
  };

  public static getDerivedStateFromError(error: Error): Partial<WidgetErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[WidgetErrorBoundary] Caught error in "${this.props.title || "Widget"}":`, error, errorInfo.componentStack);
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  public handleReset = () => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState((prevState) => ({
      hasError: false,
      error: null,
      retryCount: prevState.retryCount + 1,
    }));
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        if (typeof this.props.fallback === "function") {
          return this.props.fallback(
            this.state.error || new Error("Unknown widget error"),
            this.handleReset,
          );
        }
        return this.props.fallback;
      }

      return (
        <WidgetErrorFallback
          title={this.props.title}
          error={this.state.error}
          resetErrorBoundary={this.handleReset}
          retryCount={this.state.retryCount}
          maxRetries={this.props.maxRetries ?? 3}
          className={this.props.className}
        />
      );
    }

    return this.props.children;
  }
}
