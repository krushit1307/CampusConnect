/**
 * Maps common Supabase Auth errors to user-friendly messages.
 * @param error The raw error object from Supabase Auth
 * @returns A user-friendly error message string
 */
export function getFriendlyAuthError(error: Error): string {
  if (!error || !error.message) {
    return "An unexpected authentication error occurred. Please try again.";
  }

  const message = error.message.toLowerCase();

  if (message.includes("invalid login credentials")) {
    return "Invalid email or password. Please try again.";
  }
  if (message.includes("user already registered") || message.includes("email already in use")) {
    return "An account with this email address already exists.";
  }
  if (
    message.includes("signup requires a valid password") ||
    message.includes("password is too short") ||
    message.includes("weak password")
  ) {
    return "Password does not meet the requirements. Please use a stronger password.";
  }
  if (message.includes("email not confirmed") || message.includes("email confirmation required")) {
    return "Please confirm your email address before signing in. Check your inbox for a verification link.";
  }
  if (
    message.includes("auth session missing") ||
    message.includes("session_not_found") ||
    message.includes("session missing")
  ) {
    return "Your session has expired. Please sign in again.";
  }
  if (
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("email rate limit exceeded")
  ) {
    return "Too many attempts. Please try again later.";
  }
  if (message.includes("invalid email") || message.includes("email address is invalid")) {
    return "Please enter a valid email address.";
  }
  if (message.includes("network error") || message.includes("failed to fetch")) {
    return "Network error. Please check your connection and try again.";
  }

  // Return the original message if we don't have a specific mapping
  return error.message;
}
