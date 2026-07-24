/**
 * Maps technical authentication error messages (e.g. from Supabase)
 * to user-friendly, descriptive messages.
 */
export function getFriendlyAuthError(error: unknown): string {
  if (!error) return "An unknown authentication error occurred.";

  let message = "";
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  } else if (typeof error === "object" && error !== null && "message" in error) {
    message = String((error as { message: unknown }).message);
  } else {
    message = String(error);
  }

  const msgLower = message.toLowerCase();

  if (msgLower.includes("invalid login credentials") || msgLower.includes("invalid credentials")) {
    return "The email or password you entered is incorrect.";
  }
  if (msgLower.includes("user already registered") || msgLower.includes("already exists")) {
    return "An account with this email address already exists.";
  }
  if (msgLower.includes("email not confirmed") || msgLower.includes("email_not_confirmed")) {
    return "Please verify your email address before signing in.";
  }
  if (msgLower.includes("password should be at least")) {
    return "Your password must be at least 6 characters long.";
  }
  if (msgLower.includes("invalid email") || msgLower.includes("email address is invalid")) {
    return "Please enter a valid email address.";
  }
  if (msgLower.includes("signup disabled") || msgLower.includes("signups are disabled")) {
    return "Signups are currently disabled. Please contact the administrator.";
  }
  if (msgLower.includes("rate limit") || msgLower.includes("too many requests")) {
    return "Too many requests. Please try again in a few minutes.";
  }

  return message || "An authentication error occurred. Please try again.";
}
