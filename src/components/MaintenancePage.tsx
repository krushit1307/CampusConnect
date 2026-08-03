import { useEffect, useState } from "react";
import { AlertCircle, Mail, RefreshCw } from "lucide-react";
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
          <AlertCircle size={64} strokeWidth={2.5} />
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
            <RefreshCw size={18} strokeWidth={2.5} />
            Retry Connection
          </button>

          <a
            href="mailto:support@campusconnect.edu"
            className="neu-btn neu-btn-secondary"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Mail size={18} strokeWidth={2.5} />
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
