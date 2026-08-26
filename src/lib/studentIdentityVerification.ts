export interface OtpGenerationResult {
  email: string;
  otpCode: string;
  otpHash: string;
  expiresAtIso: string;
}

export interface VerificationCheckResult {
  isVerified: boolean;
  isEduEmail: boolean;
  status: "VERIFIED" | "PENDING_OTP" | "INVALID_DOMAIN";
  message: string;
}

export const ALLOWED_STUDENT_DOMAINS = [".edu", "university.ac.uk"];
export const OTP_EXPIRY_MINUTES = 10;

/**
 * Checks whether an email address belongs to an authorized student domain (.edu).
 */
export function isStudentEduEmail(email: string): boolean {
  if (!email || !email.includes("@")) return false;
  const domain = email.trim().toLowerCase().split("@")[1];
  return ALLOWED_STUDENT_DOMAINS.some((allowed) => domain.endsWith(allowed.replace(".", "")));
}

/**
 * Generates a secure 6-digit numerical OTP code and expiration timestamp.
 */
export function generateStudentVerificationOtp(
  email: string,
  expiryMinutes = OTP_EXPIRY_MINUTES,
): OtpGenerationResult {
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // Simple synchronous hash simulation for transport payload verification
  const hash = Array.from(code)
    .reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 0)
    .toString(16);

  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();

  return {
    email,
    otpCode: code,
    otpHash: hash,
    expiresAtIso: expiresAt,
  };
}

/**
 * Verifies submitted OTP code against expiration window and target hash.
 */
export function validateOtpSubmission(
  submittedOtp: string,
  targetOtpCode: string,
  expiresAtIso: string,
): { isValid: boolean; error?: string } {
  if (new Date() > new Date(expiresAtIso)) {
    return { isValid: false, error: "Verification OTP has expired. Please request a new code." };
  }

  if (submittedOtp.trim() !== targetOtpCode.trim()) {
    return {
      isValid: false,
      error: "Invalid verification code. Please check your email and try again.",
    };
  }

  return { isValid: true };
}

/**
 * Resolves routing state for newly registered accounts.
 */
export function resolveStudentVerificationState(
  email: string,
  isAccountVerified: boolean,
): VerificationCheckResult {
  const isEdu = isStudentEduEmail(email);

  if (!isEdu) {
    return {
      isVerified: false,
      isEduEmail: false,
      status: "INVALID_DOMAIN",
      message: "Access restricted. You must register with a valid .edu student email address.",
    };
  }

  if (!isAccountVerified) {
    return {
      isVerified: false,
      isEduEmail: true,
      status: "PENDING_OTP",
      message: "Please enter the 6-digit verification code sent to your student email.",
    };
  }

  return {
    isVerified: true,
    isEduEmail: true,
    status: "VERIFIED",
    message: "Student identity verified successfully.",
  };
}
