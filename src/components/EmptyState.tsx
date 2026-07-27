import { ReactNode } from "react";

export type EmptyStateIllustration = "no-events" | "no-members" | "no-results" | "no-clubs";

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface EmptyStateProps {
  title: string;
  description?: string;
  illustration?: EmptyStateIllustration;
  icon?: ReactNode;
  action?: EmptyStateAction;
  className?: string;
}

/**
 * Generic animated empty-state wrapper. Used anywhere a list/feed/search
 * result is empty instead of showing blank space or plain "No X" text. (#1244)
 *
 * Usage:
 *   <EmptyState
 *     illustration="no-events"
 *     title="No upcoming events"
 *     description="This club hasn't scheduled anything yet."
 *     action={{ label: "Explore Clubs", href: "/clubs" }}
 *   />
 */
export function EmptyState({
  title,
  description,
  illustration = "no-results",
  icon,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`neu-border bg-white flex flex-col items-center justify-center text-center px-6 py-12 gap-4 ${className}`}
    >
      <div className="w-40 h-40 sm:w-48 sm:h-48">
        {icon ?? <EmptyStateIllustrationSvg variant={illustration} />}
      </div>

      <h3 className="font-display text-xl font-bold uppercase text-black">{title}</h3>

      {description && <p className="font-mono text-sm text-gray-600 max-w-sm">{description}</p>}

      {action && (
        <div className="mt-2">
          {action.href ? (
            <a
              href={action.href}
              className="neu-border neu-press inline-block bg-black px-6 py-3 font-mono text-sm font-bold uppercase text-white transition-transform hover:-translate-y-1"
            >
              {action.label}
            </a>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="neu-border neu-press bg-black px-6 py-3 font-mono text-sm font-bold uppercase text-white transition-transform hover:-translate-y-1"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyStateIllustrationSvg({ variant }: { variant: EmptyStateIllustration }) {
  switch (variant) {
    case "no-events":
      return <BinocularsIllustration />;
    case "no-members":
      return <TumbleweedIllustration />;
    case "no-clubs":
      return <TumbleweedIllustration />;
    case "no-results":
    default:
      return <BinocularsIllustration />;
  }
}

/** Person looking through binoculars — for empty event/feed lists. */
function BinocularsIllustration() {
  return (
    <svg
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
      aria-hidden="true"
    >
      <ellipse cx="100" cy="178" rx="55" ry="8" fill="#000" opacity="0.06" />

      {/* body */}
      <g>
        <path d="M75 190 L80 130 L120 130 L125 190 Z" fill="#111" />
        <circle cx="100" cy="105" r="26" fill="#FFD9A0" />
        <path d="M74 108 C74 88 86 74 100 74 C114 74 126 88 126 108" fill="#111" />

        {/* binoculars, gently bobbing */}
        <g className="empty-state-float" style={{ transformOrigin: "100px 105px" }}>
          <rect x="80" y="96" width="18" height="22" rx="4" fill="#333" />
          <rect x="102" y="96" width="18" height="22" rx="4" fill="#333" />
          <rect x="94" y="102" width="12" height="8" fill="#333" />
          <circle cx="89" cy="107" r="6" fill="#0a0a0a" />
          <circle cx="111" cy="107" r="6" fill="#0a0a0a" />
        </g>
      </g>

      {/* floating dots suggesting searching/looking */}
      <circle
        className="empty-state-float-slow"
        cx="150"
        cy="70"
        r="3"
        fill="#FF6B35"
        opacity="0.5"
      />
      <circle className="empty-state-float" cx="45" cy="85" r="2.5" fill="#FF6B35" opacity="0.4" />
      <circle
        className="empty-state-float-slow"
        cx="160"
        cy="120"
        r="2"
        fill="#111"
        opacity="0.15"
      />

      <style>{`
        @keyframes emptyStateFloat {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-4px) rotate(1.5deg); }
        }
        @keyframes emptyStateFloatSlow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        .empty-state-float { animation: emptyStateFloat 3s ease-in-out infinite; }
        .empty-state-float-slow { animation: emptyStateFloatSlow 4s ease-in-out infinite; }
      `}</style>
    </svg>
  );
}

/** Rolling tumbleweed — for empty member/club lists. */
function TumbleweedIllustration() {
  return (
    <svg
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
      aria-hidden="true"
    >
      <ellipse cx="100" cy="165" rx="60" ry="7" fill="#000" opacity="0.06" />

      <g className="empty-state-roll" style={{ transformOrigin: "100px 130px" }}>
        <circle cx="100" cy="130" r="34" fill="none" stroke="#B08B5B" strokeWidth="3" />
        <path
          d="M70 130 C80 110 120 110 130 130 C120 150 80 150 70 130 Z"
          fill="none"
          stroke="#B08B5B"
          strokeWidth="2.5"
        />
        <path d="M100 96 C110 108 110 152 100 164" fill="none" stroke="#B08B5B" strokeWidth="2" />
        <path d="M66 130 C90 122 110 138 134 130" fill="none" stroke="#B08B5B" strokeWidth="2" />
        <path d="M78 108 C95 122 105 138 122 152" fill="none" stroke="#B08B5B" strokeWidth="2" />
        <path d="M122 108 C105 122 95 138 78 152" fill="none" stroke="#B08B5B" strokeWidth="2" />
      </g>

      {/* dust trail */}
      <circle
        className="empty-state-float-slow"
        cx="55"
        cy="150"
        r="2.5"
        fill="#B08B5B"
        opacity="0.3"
      />
      <circle
        className="empty-state-float"
        cx="45"
        cy="145"
        r="1.8"
        fill="#B08B5B"
        opacity="0.25"
      />
      <circle
        className="empty-state-float-slow"
        cx="38"
        cy="155"
        r="2"
        fill="#B08B5B"
        opacity="0.2"
      />

      <style>{`
        @keyframes emptyStateRoll {
          0% { transform: translateX(-6px) rotate(0deg); }
          50% { transform: translateX(6px) rotate(180deg); }
          100% { transform: translateX(-6px) rotate(360deg); }
        }
        @keyframes emptyStateFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
        @keyframes emptyStateFloatSlow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        .empty-state-roll { animation: emptyStateRoll 5s ease-in-out infinite; }
        .empty-state-float { animation: emptyStateFloat 3s ease-in-out infinite; }
        .empty-state-float-slow { animation: emptyStateFloatSlow 4s ease-in-out infinite; }
      `}</style>
    </svg>
  );
}
