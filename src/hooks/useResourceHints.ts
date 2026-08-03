import { useEffect, useRef } from 'react';

/**
 * Resource Hint Types supported by modern browsers.
 */
export type ResourceHintRel = 'preconnect' | 'dns-prefetch' | 'prefetch' | 'prerender';

/**
 * Configuration for a single resource hint.
 */
export interface ResourceHintConfig {
    /** The URL to preconnect or prefetch */
    href: string;
    /** The type of relationship */
    rel: ResourceHintRel;
    /** 
     * Whether the connection requires CORS support.
     * CRITICAL for API domains and font servers. If omitted on a CORS domain,
     * the browser will open a standard connection, discard it, and open a new one.
     */
    crossOrigin?: 'anonymous' | 'use-credentials' | '';
    /** Optional MIME type for prefetch/prerender hints */
    as?: string;
}

/**
 * useResourceHints Hook
 * 
 * Dynamically injects and manages `<link>` resource hints into the document `<head>`.
 * While static hints in `index.html` are great for initial load, this hook allows
 * components to declaratively request preconnects for domains they are about to
 * fetch from (e.g., a Map component preconnecting to the Mapbox API before mounting).
 * 
 * Edge Case Consideration:
 * Do NOT abuse this. Holding open dormant TCP connections wastes browser memory
 * and bandwidth. This hook automatically cleans up the injected `<link>` tags
 * when the component unmounts or when the hints are no longer needed.
 * 
 * @param hints - An array of ResourceHintConfig objects to inject
 * @param enabled - Boolean to conditionally enable/disable the hints
 */
export function useResourceHints(hints: ResourceHintConfig[], enabled: boolean = true): void {
    // Use a ref to keep track of the injected link elements for cleanup
    const injectedLinksRef = useRef<HTMLLinkElement[]>([]);

    useEffect(() => {
        if (!enabled || hints.length === 0) return;

        const head = document.head;
        const newLinks: HTMLLinkElement[] = [];

        hints.forEach((hint) => {
            // Check if a hint for this exact href and rel already exists to prevent duplicates
            const existingLink = document.querySelector(
                `link[rel="${hint.rel}"][href="${hint.href}"]`
            );

            if (!existingLink) {
                const link = document.createElement('link');
                link.rel = hint.rel;
                link.href = hint.href;

                if (hint.crossOrigin !== undefined) {
                    link.crossOrigin = hint.crossOrigin;
                }

                if (hint.as) {
                    link.as = hint.as;
                }

                head.appendChild(link);
                newLinks.push(link);
            }
        });

        // Store the newly created links in the ref
        injectedLinksRef.current = newLinks;

        // Cleanup function: Remove the injected links when the component unmounts
        // or when the hints array changes. This prevents memory/connection leaks.
        return () => {
            injectedLinksRef.current.forEach((link) => {
                if (link.parentNode === head) {
                    head.removeChild(link);
                }
            });
            injectedLinksRef.current = [];
        };
    }, [hints, enabled]);
}

/**
 * Pre-configured hook for the Supabase API and Storage domains.
 * Useful for components that know they will immediately fetch from Supabase.
 */
export function useSupabaseResourceHints(): void {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

    const hints: ResourceHintConfig[] = [
        { rel: 'preconnect', href: supabaseUrl, crossOrigin: 'anonymous' },
        { rel: 'dns-prefetch', href: supabaseUrl },
    ];

    useResourceHints(hints, !!supabaseUrl);
}

/**
 * Pre-configured hook for external image CDNs (e.g., Unsplash, AWS S3).
 */
export function useImageCDNResourceHints(): void {
    const hints: ResourceHintConfig[] = [
        { rel: 'preconnect', href: 'https://images.unsplash.com', crossOrigin: 'anonymous' },
        { rel: 'dns-prefetch', href: 'https://images.unsplash.com' },
        { rel: 'preconnect', href: 'https://s3.amazonaws.com', crossOrigin: 'anonymous' },
        { rel: 'dns-prefetch', href: 'https://s3.amazonaws.com' },
    ];

    useResourceHints(hints, true);
}
