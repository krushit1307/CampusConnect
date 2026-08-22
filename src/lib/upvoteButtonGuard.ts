export interface AuthUserContext {
  id?: string;
  email?: string;
}

export interface UpvoteButtonPropsState {
  isDisabled: boolean;
  tooltipText: string;
  cssClasses: string;
}

export const GUEST_UPVOTE_TOOLTIP = "Log in to upvote events";
export const AUTHORIZED_UPVOTE_TOOLTIP = "Upvote this event";

/**
 * Resolves the visual and functional state for the event Upvote button based on user authentication context.
 */
export function resolveUpvoteButtonState(
  user: AuthUserContext | null | undefined,
  hasAlreadyUpvoted = false,
): UpvoteButtonPropsState {
  const isAuthenticated = !!(user && user.id);

  if (!isAuthenticated) {
    return {
      isDisabled: true,
      tooltipText: GUEST_UPVOTE_TOOLTIP,
      cssClasses: "opacity-50 cursor-not-allowed bg-gray-100 text-gray-400",
    };
  }

  return {
    isDisabled: false,
    tooltipText: hasAlreadyUpvoted ? "Remove upvote" : AUTHORIZED_UPVOTE_TOOLTIP,
    cssClasses: hasAlreadyUpvoted
      ? "bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
      : "bg-gray-200 text-gray-700 hover:bg-gray-300 cursor-pointer",
  };
}

/**
 * Click handler wrapper ensuring unauthenticated upvote clicks are safely intercepted without throwing runtime errors.
 */
export function handleUpvoteClick(
  user: AuthUserContext | null | undefined,
  onUpvoteAction: () => void,
): boolean {
  if (!user || !user.id) {
    return false; // Intercepted: User not logged in
  }

  onUpvoteAction();
  return true; // Successfully triggered
}
