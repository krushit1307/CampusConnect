// =============================================================================
// Utility: PWA Manifest Generator & Injector
//  Issue: #3345 - Implement 'Dynamic PWA App Icon Switching'
//  Description: Client-side utilities to manage the dynamic injection of the 
//  Web App Manifest link into the document <head>, allowing the browser to 
//  pick up the new theme color and icon URLs.
// =============================================================================

export type IconTheme = 'default' | 'dark' | 'red' | 'purple' | 'green';

export interface ThemeConfig {
    id: IconTheme;
    label: string;
    hex: string;
    previewClass: string;
}

export const AVAILABLE_THEMES: ThemeConfig[] = [
    { id: 'default', label: 'Classic Indigo', hex: '#4F46E5', previewClass: 'bg-indigo-600' },
    { id: 'dark', label: 'Midnight Dark', hex: '#1F2937', previewClass: 'bg-gray-800' },
    { id: 'red', label: 'Crimson Red', hex: '#DC2626', previewClass: 'bg-red-600' },
    { id: 'purple', label: 'Royal Purple', hex: '#9333EA', previewClass: 'bg-purple-600' },
    { id: 'green', label: 'Forest Green', hex: '#16A34A', previewClass: 'bg-green-600' },
];

const MANIFEST_LINK_ID = 'campusconnect-pwa-manifest';

/**
 * Dynamically updates or injects the <link rel="manifest"> tag in the <head>.
 * Appends the theme as a query parameter to bypass browser caching of the manifest.
 * 
 * @param theme - The selected icon theme
 */
export function injectDynamicManifest(theme: IconTheme): void {
    if (typeof document === 'undefined') return;

    // Remove existing manifest link if present
    const existingLink = document.getElementById(MANIFEST_LINK_ID);
    if (existingLink) {
        existingLink.remove();
    }

    // Create and inject new manifest link
    const link = document.createElement('link');
    link.id = MANIFEST_LINK_ID;
    link.rel = 'manifest';
    // Point to the Edge Function handling dynamic generation
    link.href = `/api/dynamic-manifest?theme=${theme}&v=${Date.now()}`;

    document.head.appendChild(link);

    // Also update the theme-color meta tag for the browser chrome
    updateThemeColorMeta(theme);
}

/**
 * Updates the <meta name="theme-color"> tag to match the selected theme.
 * This changes the color of the Android status bar and browser tab header.
 */
export function updateThemeColorMeta(theme: IconTheme): void {
    if (typeof document === 'undefined') return;

    const themeConfig = AVAILABLE_THEMES.find(t => t.id === theme) || AVAILABLE_THEMES[0];

    let metaTag = document.querySelector('meta[name="theme-color"]');
    if (!metaTag) {
        metaTag = document.createElement('meta');
        metaTag.setAttribute('name', 'theme-color');
        document.head.appendChild(metaTag);
    }

    metaTag.setAttribute('content', themeConfig.hex);
}

/**
 * Retrieves the currently saved theme from localStorage.
 */
export function getSavedTheme(): IconTheme {
    if (typeof window === 'undefined') return 'default';
    return (localStorage.getItem('campusconnect_icon_theme') as IconTheme) || 'default';
}

/**
 * Saves the selected theme to localStorage and triggers the manifest update.
 */
export function saveAndApplyTheme(theme: IconTheme): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('campusconnect_icon_theme', theme);
    injectDynamicManifest(theme);
}
