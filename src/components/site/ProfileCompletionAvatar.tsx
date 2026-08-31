import { ProgressRing } from "@/components/profile/ProgressRing";

interface ProfileCompletionAvatarProps {
  /** Short label rendered inside the ring (usually the user's initial). */
  initials: string;
  /** Profile completion percentage (0-100) driving the animated ring. */
  percentage?: number;
}

/**
 * Navbar avatar trigger wrapped in an animated SVG completion ring (#2389).
 * The ring starts empty on mount and animates to the completion percentage,
 * nudging users to finish setting up their profile.
 */
export function ProfileCompletionAvatar({
  initials,
  percentage = 0,
}: ProfileCompletionAvatarProps) {
  return (
    <button
      type="button"
      aria-label="User menu"
      title={`Profile ${percentage}% complete`}
      className="relative flex h-11 w-11 items-center justify-center rounded-full border-2 border-black bg-lime font-mono text-xs font-bold uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 dark:focus-visible:ring-cream"
    >
      <ProgressRing size={40} strokeWidth={3} showBadge={false} percentage={percentage}>
        <span aria-hidden="true">{initials}</span>
      </ProgressRing>
    </button>
  );
}
