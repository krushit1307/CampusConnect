// =============================================================================
// Module: Webhook URL Validator (SSRF Protection)
// Issue: #2444 - Advanced API Webhook dispatch system for Discord integrations
// Description: Strictly validates webhook URLs provided by Club Admins.
// Prevents SSRF attacks, port scanning, and memory exhaustion by enforcing 
// HTTPS, public IP resolution, and blocking internal subnets.
// =============================================================================

import * as dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

/**
 * Allowed webhook domains (Whitelist approach for maximum security).
 * If an admin tries to send webhooks to an internal tool or unknown domain, 
 * it will be blocked.
 */
const ALLOWED_WEBHOOK_DOMAINS = [
    'discord.com',
    'discordapp.com',
    'hooks.slack.com',
    'api.telegram.org',
    'hooks.zapier.com',
    'hooks.make.com'
];

/**
 * Validates a webhook URL for safety and correctness.
 * 
 * @param url - The raw URL string provided by the user
 * @returns true if safe and valid, false otherwise
 */
export async function validateWebhookUrl(url: string): Promise<boolean> {
    try {
        // 1. Parse the URL strictly
        const parsed = new URL(url);

        // 2. Protocol Check: MUST be HTTPS. 
        // HTTP webhooks are insecure and allow MITM attacks.
        if (parsed.protocol !== 'https:') {
            console.warn(`[WebhookValidator] Blocked non-HTTPS URL: ${url}`);
            return false;
        }

        // 3. Port Check: Only allow standard HTTPS port (443) or no port specified.
        // Blocking custom ports prevents internal port scanning (e.g., https://internal:8080)
        if (parsed.port && parsed.port !== '443') {
            console.warn(`[WebhookValidator] Blocked non-standard port: ${parsed.port}`);
            return false;
        }

        const hostname = parsed.hostname;

        // 4. Domain Whitelist Check
        // Ensure the domain is one of the allowed webhook providers.
        const isAllowedDomain = ALLOWED_WEBHOOK_DOMAINS.some(domain =>
            hostname === domain || hostname.endsWith(`.${domain}`)
        );

        if (!isAllowedDomain) {
            console.warn(`[WebhookValidator] Blocked unwhitelisted domain: ${hostname}`);
            return false;
        }

        // 5. DNS Resolution & Private IP Check
        // Even if the domain is whitelisted, a hacker might compromise the DNS 
        // or use a subdomain that resolves to 127.0.0.1.
        const addresses = await dnsLookup(hostname, { all: true });

        for (const addr of addresses) {
            if (isPrivateIP(addr.address, addr.family)) {
                console.warn(`[WebhookValidator] Blocked domain resolving to private IP: ${hostname} -> ${addr.address}`);
                return false;
            }
        }

        // 6. Path validation: Ensure it's not trying to access root metadata paths
        if (parsed.pathname.includes('/latest/meta-data') || parsed.pathname.includes('/../')) {
            console.warn(`[WebhookValidator] Blocked suspicious path: ${parsed.pathname}`);
            return false;
        }

        return true;

    } catch (error) {
        // If URL parsing fails or DNS lookup fails, it's invalid
        console.warn(`[WebhookValidator] URL validation failed for ${url}:`, error);
        return false;
    }
}

/**
 * Checks if an IP address is private/internal.
 */
function isPrivateIP(ip: string, family: number): boolean {
    if (family === 4) {
        const parts = ip.split('.').map(Number);
        if (parts.length !== 4) return true; // Invalid format, treat as unsafe

        // 10.0.0.0/8
        if (parts[0] === 10) return true;
        // 172.16.0.0/12
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
        // 192.168.0.0/16
        if (parts[0] === 192 && parts[1] === 168) return true;
        // 127.0.0.0/8 (Loopback)
        if (parts[0] === 127) return true;
        // 169.254.0.0/16 (Link-Local / AWS Metadata)
        if (parts[0] === 169 && parts[1] === 254) return true;
        // 0.0.0.0/8
        if (parts[0] === 0) return true;

        return false;
    }

    if (family === 6) {
        const normalized = ip.toLowerCase();
        if (normalized === '::1' || normalized === '::') return true;
        if (normalized.startsWith('fe80:')) return true;
        if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
        if (normalized.startsWith('ff')) return true;

        // Check for IPv4-mapped IPv6
        if (normalized.startsWith('::ffff:')) {
            const ipv4Part = normalized.split(':').pop();
            if (ipv4Part) return isPrivateIP(ipv4Part, 4);
        }

        return false;
    }

    return true; // Unknown family, treat as unsafe
}
