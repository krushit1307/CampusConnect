export interface PrivateDocumentRequest {
  clubId: string;
  filePath: string;
  userId: string;
  userClubIds: string[]; // List of club IDs the user is an active member of
}

export interface SignedUrlResult {
  allowed: boolean;
  signedUrl?: string;
  expiresInSeconds?: number;
  reason?: string;
}

export const DEFAULT_SIGNED_URL_EXPIRES_IN = 300; // 5 Minutes (300s) for generous slow connection downloads

/**
 * Validates club membership and generates signed URL parameters for private document access.
 */
export function generatePrivateDocumentSignedUrl(
  request: PrivateDocumentRequest,
  expiresInSeconds: number = DEFAULT_SIGNED_URL_EXPIRES_IN,
): SignedUrlResult {
  const isMember = request.userClubIds.includes(request.clubId);

  if (!isMember) {
    return {
      allowed: false,
      reason: "Access Denied: You must be an active club member to access this private document.",
    };
  }

  // Sanitize path and construct signed token URL structure
  const cleanPath = request.filePath.replace(/^\/+/, "");
  const mockToken = `token_${Math.random().toString(36).substring(2, 10)}`;
  const signedUrl = `https://supabase.campusconnect.edu/storage/v1/object/sign/club_documents/${request.clubId}/${cleanPath}?token=${mockToken}`;

  return {
    allowed: true,
    signedUrl,
    expiresInSeconds,
  };
}
