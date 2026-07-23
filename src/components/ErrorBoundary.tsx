import React from "react";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const MAX_SOFT_RETRIES = 2;

interface ErrorFallbackProps {
  message: string;
  stack?: string;
  tryAgainLabel: string;
  detailsOpen: boolean;
  onTryAgain: () => void;
  onGoHome: () => void;
  onToggleDetails: () => void;
}

function ErrorFallback({
  message,
  stack,
  tryAgainLabel,
  detailsOpen,
  onTryAgain,
  onGoHome,
  onToggleDetails,
}: ErrorFallbackProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cream px-4 py-16 sm:px-6">
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, black 2.5px, transparent 0)`,
          backgroundSize: "24px 24px",
        }}
      />

      <div className="absolute -left-12 top-10 h-32 w-32 rotate-12 border-4 border-black bg-destructive shadow-[6px_6px_0_0_var(--color-ink)] sm:h-44 sm:w-44" />
      <div className="absolute -right-10 bottom-12 h-28 w-28 -rotate-12 border-4 border-black bg-peach shadow-[6px_6px_0_0_var(--color-ink)] sm:h-40 sm:w-40" />

      <section className="relative z-10 mx-auto flex w-full max-w-lg flex-col items-center text-center border-4 border-black bg-white p-6 shadow-[10px_10px_0_0_var(--color-ink)] sm:p-10">
        <div className="relative mb-2 flex flex-col items-center">
          <div className="neu-border relative mb-3 bg-white px-3 py-1.5 font-mono text-xs font-bold uppercase shadow-[3px_3px_0_0_var(--color-ink)]">
            Uh oh.
            <div className="absolute -bottom-2 left-1/2 h-0 w-0 -translate-x-1/2 border-x-4 border-t-8 border-x-transparent border-t-black" />
          </div>
          <div className="neu-border flex h-24 w-28 flex-col items-center justify-center bg-destructive/20 p-2 shadow-[4px_4px_0_0_var(--color-ink)]">
            <div className="flex gap-4">
              <div className="h-3 w-3 rounded-full bg-black" />
              <div className="h-3 w-3 rounded-full bg-black" />
            </div>
            <div className="mt-3 font-mono text-xl font-bold leading-none">(x_x)</div>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center gap-2">
          <h1 className="font-display text-2xl font-black leading-snug text-black sm:text-3xl">
            Something broke.
          </h1>
          <p className="mx-auto max-w-xs font-mono text-xs leading-relaxed text-gray-700 sm:max-w-sm sm:text-sm">
            An unexpected error occurred. You can try again, or head back to a safe page.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onTryAgain}
            className="neu-border bg-lime text-black hover:bg-lime/90 font-mono font-bold uppercase tracking-wider px-6 py-3 shadow-[4px_4px_0_0_var(--color-ink)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_var(--color-ink)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-[0px_0px_0_0_var(--color-ink)]"
          >
            {tryAgainLabel}
          </button>
          <button
            type="button"
            onClick={onGoHome}
            className="neu-border bg-white text-black hover:bg-gray-50 font-mono font-bold uppercase tracking-wider px-6 py-3 shadow-[4px_4px_0_0_var(--color-ink)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_var(--color-ink)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-[0px_0px_0_0_var(--color-ink)]"
          >
            Go Home
          </button>
        </div>

        <Collapsible
          open={detailsOpen}
          onOpenChange={onToggleDetails}
          className="mt-6 w-full text-left"
        >
          <CollapsibleTrigger className="neu-border w-full bg-white px-4 py-2 font-mono text-xs font-bold uppercase shadow-[3px_3px_0_0_var(--color-ink)]">
            {detailsOpen ? "Hide error details" : "Show error details"}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <pre className="neu-border max-h-64 overflow-auto bg-cream p-3 text-left font-mono text-xs leading-relaxed">
              {message}
              {stack ? `\n\n${stack}` : null}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      </section>
    </main>
  );
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  retryCount: number;
  detailsOpen: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      detailsOpen: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo.componentStack);

    this.setState({ errorInfo });
  }

  handleTryAgain = () => {
    if (this.state.retryCount >= MAX_SOFT_RETRIES) {
      window.location.reload();
      return;
    }

    this.setState((prev) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prev.retryCount + 1,
    }));
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  toggleDetails = () => {
    this.setState((prev) => ({ detailsOpen: !prev.detailsOpen }));
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error, errorInfo, retryCount, detailsOpen } = this.state;

    return (
      <ErrorFallback
        message={error?.message ?? "Unknown error"}
        stack={errorInfo?.componentStack ?? undefined}
        tryAgainLabel={retryCount >= MAX_SOFT_RETRIES ? "Reload Page" : "Try Again"}
        detailsOpen={detailsOpen}
        onTryAgain={this.handleTryAgain}
        onGoHome={this.handleGoHome}
        onToggleDetails={this.toggleDetails}
      />
    );
  }
}

export function RouteErrorBoundary() {
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const routeError = useRouteError();

  React.useEffect(() => {
    console.error("RouteErrorBoundary caught an error:", routeError);
  }, [routeError]);

  let message = "Unknown error";
  let stack: string | undefined;

  if (isRouteErrorResponse(routeError)) {
    message = `${routeError.status} ${routeError.statusText}`;
  } else if (routeError instanceof Error) {
    message = routeError.message;
    stack = routeError.stack;
  }

  return (
    <ErrorFallback
      message={message}
      stack={stack}
      tryAgainLabel="Reload Page"
      detailsOpen={detailsOpen}
      onTryAgain={() => window.location.reload()}
      onGoHome={() => {
        window.location.href = "/";
      }}
      onToggleDetails={() => setDetailsOpen((prev) => !prev)}
    />
  );
}

export default ErrorBoundary;
