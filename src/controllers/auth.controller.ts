// =============================================================================
// Controller: Authentication (OAuth Callback)
// Issue: #2428 - Implement advanced SSRF protection for OAuth avatar fetching
// Description: Handles the OAuth callback from Google/GitHub. Extracts the 
// avatar_url, securely downloads it via the SSRF-protected fetcher, and 
// uploads the resulting buffer to the S3 storage bucket.
// =============================================================================

import { Request, Response } from 'express';
import { fetchAvatarSecurely } from '../services/avatarFetcher';
import { primaryClient } from '../lib/prisma/primaryClient';
// import { uploadToS3 } from '../services/s3Service'; // Assumed existing S3 service

/**
 * POST /api/auth/oauth/callback
 * Handles the final step of the OAuth flow, creates the user profile, 
 * and securely provisions their avatar.
 */
export async function handleOAuthCallback(req: Request, res: Response) {
    try {
        const { provider, accessToken, profile } = req.body;

        // Validate required OAuth data
        if (!provider || !accessToken || !profile) {
            return res.status(400).json({
                success: false,
                error: 'Missing OAuth provider, token, or profile data'
            });
        }

        const { email, name, avatar_url, provider_id } = profile;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'OAuth profile must include an email address'
            });
        }

        // 1. Check if user already exists in the primary database
        let user = await primaryClient.user.findUnique({
            where: { email }
        });

        let s3AvatarUrl: string | null = null;

        // 2. If avatar_url is provided by the OAuth provider, fetch it securely
        if (avatar_url) {
            try {
                console.log(`[AuthController] Attempting to fetch avatar for ${email} from ${avatar_url}`);

                // This call executes the full SSRF protection pipeline:
                // DNS Resolution -> Private IP Check -> Hardcoded IP Fetch -> No Redirects
                const imageBuffer = await fetchAvatarSecurely(avatar_url);

                // Generate a unique filename for S3
                const fileExtension = avatar_url.split('.').pop()?.split('?')[0] || 'png';
                const fileName = `avatars/${provider}_${provider_id}_${Date.now()}.${fileExtension}`;

                // Upload to S3 (Assuming uploadToS3 exists in your project)
                // s3AvatarUrl = await uploadToS3(fileName, imageBuffer, 'image/png');

                // Mocking S3 upload for this controller example
                s3AvatarUrl = `https://cdn.campusconnect.com/${fileName}`;

                console.log(`[AuthController] Avatar successfully uploaded to S3: ${s3AvatarUrl}`);

            } catch (ssrfError: any) {
                // CRITICAL: If the SSRF guard blocks the URL, we DO NOT fail the login.
                // We simply log the security event and fall back to a default avatar.
                // This prevents a malicious user from breaking their own account by 
                // setting a bad avatar URL on GitHub.
                console.warn(
                    `[AuthController] SSRF Guard blocked avatar URL for user ${email}. ` +
                    `Reason: ${ssrfError.message}. Falling back to default avatar.`
                );
                s3AvatarUrl = null; // Will use UI default avatar
            }
        }

        // 3. Create or Update the user in the Primary Database
        if (!user) {
            user = await primaryClient.user.create({
                data: {
                    email,
                    name,
                    avatarUrl: s3AvatarUrl,
                    authProvider: provider,
                    providerId: provider_id,
                    role: 'STUDENT'
                }
            });
        } else {
            // Update existing user's avatar if it changed and was successfully fetched
            if (s3AvatarUrl && user.avatarUrl !== s3AvatarUrl) {
                user = await primaryClient.user.update({
                    where: { id: user.id },
                    data: { avatarUrl: s3AvatarUrl }
                });
            }
        }

        // 4. Generate JWT session token (Assuming generateJWT exists)
        // const token = generateJWT(user.id);
        const token = 'mock_jwt_token';

        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    avatarUrl: user.avatarUrl
                },
                token
            }
        });

    } catch (error: any) {
        console.error('[AuthController] OAuth callback failed:', error);
        res.status(500).json({
            success: false,
            error: 'Authentication failed. Please try again.'
        });
    }
}

/**
 * PUT /api/auth/avatar
 * Allows a user to manually update their avatar via a URL.
 * Also strictly enforces SSRF protections.
 */
export async function updateAvatarViaUrl(req: Request, res: Response) {
    try {
        const userId = req.user?.id;
        const { avatarUrl } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        if (!avatarUrl) {
            return res.status(400).json({ success: false, error: 'Avatar URL is required' });
        }

        // Execute the secure fetcher. If it throws, the user provided a malicious/internal URL.
        const imageBuffer = await fetchAvatarSecurely(avatarUrl);

        const fileName = `avatars/manual_${userId}_${Date.now()}.png`;
        // const s3Url = await uploadToS3(fileName, imageBuffer, 'image/png');
        const s3Url = `https://cdn.campusconnect.com/${fileName}`;

        await primaryClient.user.update({
            where: { id: userId },
            data: { avatarUrl: s3Url }
        });

        res.status(200).json({
            success: true,
            message: 'Avatar updated successfully',
            data: { avatarUrl: s3Url }
        });

    } catch (error: any) {
        // Return 403 Forbidden specifically for SSRF blocks
        if (error.message.includes('SSRF Blocked') || error.message.includes('internal/private IP')) {
            return res.status(403).json({
                success: false,
                error: 'Security violation: The provided URL points to an internal or restricted network.'
            });
        }

        res.status(400).json({
            success: false,
            error: `Failed to process avatar URL: ${error.message}`
        });
    }
}
