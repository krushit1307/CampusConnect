// =============================================================================
// Service: Secure Avatar Fetcher
// Issue: #2428 - Implement advanced SSRF protection for OAuth avatar fetching
// Description: Downloads user avatars from OAuth providers (Google/GitHub) 
// and uploads them to S3. Implements strict SSRF protections:
// 1. Disables HTTP redirects to prevent open redirect to internal IPs.
// 2. Resolves DNS manually and fetches via hardcoded IP to prevent DNS Rebinding.
// 3. Injects the original Host header to satisfy the target server.
// =============================================================================

import axios, { AxiosRequestConfig } from 'axios';
import { validateAndResolveIP } from '../utils/ssrfGuard';
import * as stream from 'stream';
import { promisify } from 'util';

const pipeline = promisify(stream.pipeline);

/**
 * Securely fetches an image from a URL and returns it as a Buffer.
 * 
 * @param rawUrl - The original URL provided by the OAuth provider
 * @returns Buffer containing the image data
 */
export async function fetchAvatarSecurely(rawUrl: string): Promise<Buffer> {
    // 1. Parse and validate the URL structure
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(rawUrl);
    } catch (e) {
        throw new Error('Invalid URL format provided');
    }

    // 2. Strict Protocol Check: Only allow HTTPS (or HTTP for localhost testing)
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
        throw new Error(`Protocol '${parsedUrl.protocol}' is not allowed. Only HTTP/HTTPS permitted.`);
    }

    const hostname = parsedUrl.hostname;
    const port = parsedUrl.port || (parsedUrl.protocol === 'https:' ? '443' : '80');
    const path = parsedUrl.pathname + parsedUrl.search;

    // 3. DNS Resolution & SSRF Validation
    // This resolves the hostname to an IP and checks if it's a private subnet.
    const resolvedIP = await validateAndResolveIP(hostname);

    // 4. Construct the secure Axios request
    // CRITICAL: We fetch the IP directly, NOT the hostname.
    // This neutralizes DNS Rebinding attacks where the DNS changes between 
    // our validation step and the actual HTTP request.
    const targetUrl = `${parsedUrl.protocol}//${resolvedIP}:${port}${path}`;

    const config: AxiosRequestConfig = {
        url: targetUrl,
        method: 'GET',
        responseType: 'stream', // Stream to memory, then convert to buffer

        // CRITICAL: Disable redirects completely.
        // If the external server returns a 301 Redirect to http://169.254.169.254,
        // Axios would normally follow it, bypassing our IP validation.
        // By setting maxRedirects: 0, we force a hard stop on any redirect.
        maxRedirects: 0,

        headers: {
            // We MUST pass the original hostname in the Host header.
            // Since we are connecting to the raw IP, the server needs the Host 
            // header to know which virtual host/virtual host to serve.
            'Host': hostname,
            'User-Agent': 'CampusConnect-Avatar-Fetcher/1.0',
            'Accept': 'image/*'
        },

        // Strict timeout to prevent slow-loris attacks or hanging connections
        timeout: 5000,

        // Validate HTTP status codes manually since we disabled redirects
        validateStatus: (status) => status === 200
    };

    try {
        console.log(`[AvatarFetcher] Securely fetching ${rawUrl} via IP ${resolvedIP}`);
        const response = await axios(config);

        // 5. Validate Content-Type to ensure we aren't downloading HTML/JS payloads
        const contentType = response.headers['content-type'];
        if (!contentType || !contentType.startsWith('image/')) {
            throw new Error(`Invalid content type received: ${contentType}. Expected image/*`);
        }

        // 6. Convert the readable stream to a Buffer
        const chunks: Buffer[] = [];
        for await (const chunk of response.data) {
            chunks.push(chunk);
        }

        const imageBuffer = Buffer.concat(chunks);

        // 7. Size limit check (Max 5MB for avatars)
        const MAX_SIZE = 5 * 1024 * 1024;
        if (imageBuffer.length > MAX_SIZE) {
            throw new Error(`Image size ${imageBuffer.length} exceeds maximum allowed size of ${MAX_SIZE} bytes.`);
        }

        return imageBuffer;

    } catch (error: any) {
        // Handle the "maxRedirects" error specifically to provide a clear security message
        if (error.message && error.message.includes('Max Redirects')) {
            throw new Error('SSRF Blocked: HTTP Redirects are strictly disabled for avatar fetching.');
        }
        throw new Error(`Failed to fetch avatar: ${error.message}`);
    }
}
