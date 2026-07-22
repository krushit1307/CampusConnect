import { useEffect, useState } from "react";
import "./MaintenancePage.css";

export interface MaintenancePageProps {
  onRetry?: () => void;
  errorDetails?: string;
}

export default function MaintenancePage({ onRetry, errorDetails }: MaintenancePageProps) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    // Honor prefers-reduced-motion: skip animation if user requests reduced motion
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) {
      setDots("...");
      return undefined;
    }

    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="maintenance-container">
      <div className="maintenance-card">
        <div className="maintenance-icon" aria-hidden="true">
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2v4" />
            <path d="m5 5 2.8 2.8" />
            <path d="m19 5-2.8 2.8" />
            <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
            <path d="M12 18v2" />
            <path d="m17 17-2.8-2.8" />
            <path d="m7 17 2.8-2.8" />
            <path d="M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
            <line x1="18" y1="6" x2="6" y2="18" strokeWidth="3" />
          </svg>
        </div>

        <h1 className="maintenance-title">Under Maintenance</h1>
        <p className="maintenance-subtitle">
          We&apos;re fixing things up behind the scenes
          {dots}
        </p>

        <div className="maintenance-status-box">
          <span className="status-indicator" />
          <span className="status-text">Database connection unavailable</span>
        </div>

        {errorDetails && (
          <details className="error-details">
            <summary>Technical Details</summary>
            <code>{errorDetails}</code>
          </details>
        )}

        <div className="maintenance-actions">
          <button type="button" className="neu-btn neu-btn-primary" onClick={handleRetry}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
            Retry Connection
          </button>

          <a
            href="mailto:support@campusconnect.edu"
            className="neu-btn neu-btn-secondary"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            Contact Support
          </a>
        </div>

        <div className="maintenance-links">
          <a href="https://status.campusconnect.edu" target="_blank" rel="noopener noreferrer">
            System Status →
          </a>
          <a href="https://twitter.com/CampusConnect" target="_blank" rel="noopener noreferrer">
            Updates on X →
          </a>
        </div>
      </div>

      <div className="maintenance-footer">
        <p>CampusConnect Team • {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
