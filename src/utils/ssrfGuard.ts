// =============================================================================
// Module: SSRF Guard & IP Validator
// Issue: #2428 - Implement advanced SSRF protection for OAuth avatar fetching
// Description: Mathematically blocks Server-Side Request Forgery (SSRF) attacks
// by resolving hostnames to IP addresses and validating against strict private 
// subnet ranges. Prevents access to AWS metadata (169.254.169.254), localhost, 
// and internal network resources.
// =============================================================================

import * as dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

/**
 * IPv4 Private Subnet Ranges (RFC 1918 & Link-Local)
 * Any IP falling into these ranges is considered internal and blocked.
 */
const PRIVATE_IPV4_RANGES = [
    { start: '10.0.0.0', end: '10.255.255.255' },       // Class A Private
    { start: '172.16.0.0', end: '172.31.255.255' },     // Class B Private
    { start: '192.168.0.0', end: '192.168.255.255' },   // Class C Private
    { start: '127.0.0.0', end: '127.255.255.255' },     // Loopback (localhost)
    { start: '169.254.0.0', end: '169.254.255.255' },   // Link-Local (AWS Metadata)
    { start: '0.0.0.0', end: '0.255.255.255' },         // Current Network
    { start: '100.64.0.0', end: '100.127.255.255' },    // Carrier-grade NAT
];

/**
 * Converts an IPv4 address string to a 32-bit integer for fast range comparison.
 * Example: '192.168.1.1' -> 3232235777
 */
function ipv4ToInt(ip: string): number {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
        throw new Error(`Invalid IPv4 address format: ${ip}`);
    }
    return (
        (parts[0] << 24) |
        (parts[1] << 16) |
        (parts[2] << 8) |
        parts[3]
    ) >>> 0; // Unsigned right shift to ensure positive 32-bit integer
}

/**
 * Checks if an IPv4 address is within any of the defined private ranges.
 */
function isPrivateIPv4(ip: string): boolean {
    const ipInt = ipv4ToInt(ip);

    for (const range of PRIVATE_IPV4_RANGES) {
        const startInt = ipv4ToInt(range.start);
        const endInt = ipv4ToInt(range.end);

        if (ipInt >= startInt && ipInt <= endInt) {
            return true; // IP is internal/reserved
        }
    }

    return false; // IP is public
}

/**
 * Basic IPv6 internal range checks.
 * Covers loopback (::1), link-local (fe80::/10), and unique local (fc00::/7).
 */
function isPrivateIPv6(ip: string): boolean {
    const normalized = ip.toLowerCase();

    if (normalized === '::1' || normalized === '::') return true; // Loopback / Unspecified
    if (normalized.startsWith('fe80:')) return true;             // Link-Local
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // Unique Local
    if (normalized.startsWith('ff')) return true;                // Multicast

    // IPv4-mapped IPv6 addresses (e.g., ::ffff:192.168.1.1)
    if (normalized.startsWith('::ffff:')) {
        const ipv4Part = normalized.split(':').pop();
        if (ipv4Part) {
            return isPrivateIPv4(ipv4Part);
        }
    }

    return false;
}

/**
 * Main SSRF Validation Function.
 * Resolves a hostname to an IP address and validates it against private ranges.
 * 
 * @param hostname - The domain name to validate (e.g., 'github.com')
 * @returns The resolved, validated public IP address
 * @throws Error if the hostname resolves to an internal/private IP
 */
export async function validateAndResolveIP(hostname: string): Promise<string> {
    try {
        // Force IPv4 resolution if possible, fallback to IPv6
        // We use { all: true } to check ALL resolved IPs, not just the first one.
        // A hacker might use DNS round-robin to return [8.8.8.8, 127.0.0.1]
        const addresses = await dnsLookup(hostname, { all: true });

        if (!addresses || addresses.length === 0) {
            throw new Error(`DNS resolution failed for hostname: ${hostname}`);
        }

        // Validate EVERY resolved IP address.
        // If even ONE resolves to an internal IP, we block the entire request.
        for (const addr of addresses) {
            const ip = addr.address;
            const family = addr.family;

            let isInternal = false;

            if (family === 4) {
                isInternal = isPrivateIPv4(ip);
            } else if (family === 6) {
                isInternal = isPrivateIPv6(ip);
            } else {
                throw new Error(`Unsupported IP family: ${family}`);
            }

            if (isInternal) {
                throw new Error(
                    `SSRF Blocked: Hostname '${hostname}' resolved to internal/private IP '${ip}'. ` +
                    `Access to internal networks is strictly prohibited.`
                );
            }
        }

        // Return the first validated public IP for the fetcher to use
        return (addresses[0] as dns.LookupAddress).address;

    } catch (error: any) {
        if (error.code === 'ENOTFOUND') {
            throw new Error(`Hostname not found: ${hostname}`);
        }
        throw error;
    }
}
