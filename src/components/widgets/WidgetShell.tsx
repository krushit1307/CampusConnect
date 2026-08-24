import type { ReactNode } from "react";

interface WidgetShellProps {
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Shared card frame for club homepage widgets. Uses the neubrutalist
 * border style and the club's configured theme colors so every widget
 * type looks consistent on the public profile.
 */
export function WidgetShell({ title, icon, children, className = "" }: WidgetShellProps) {
  return (
    <div className={`neu-border flex flex-col bg-white dark:bg-zinc-900 ${className}`}>
      {title && (
        <div className="flex items-center gap-2 border-b-2 border-black px-4 py-3 dark:border-cream">
          {icon && <span className="shrink-0 text-[var(--theme-primary)]">{icon}</span>}
          <h3 className="font-display text-xs font-bold uppercase tracking-tight text-[var(--theme-primary)]">
            {title}
          </h3>
        </div>
      )}
      <div className="flex-1 p-4">{children}</div>
    </div>
  );
}
