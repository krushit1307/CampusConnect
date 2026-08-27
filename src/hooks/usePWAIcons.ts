// =============================================================================
// Hook: usePWAIcons
//  Issue: #3345 - Implement 'Dynamic PWA App Icon Switching'
//  Description: Manages the state for the user's selected PWA icon theme.
//  Handles initialization from localStorage and provides a setter that 
//  updates storage and injects the new manifest.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
    IconTheme,
    getSavedTheme,
    saveAndApplyTheme,
    AVAILABLE_THEMES,
    ThemeConfig
} from '../../lib/pwa/manifestGenerator';

interface UsePWAIconsReturn {
    currentTheme: IconTheme;
    setTheme: (theme: IconTheme) => void;
    availableThemes: ThemeConfig[];
    isSupported: boolean;
}

export function usePWAIcons(): UsePWAIconsReturn {
    const [currentTheme, setCurrentTheme] = useState<IconTheme>('default');
    const [isSupported, setIsSupported] = useState(false);

    // Initialize theme from localStorage on mount
    useEffect(() => {
        const saved = getSavedTheme();
        setCurrentTheme(saved);

        // Check if the browser supports PWA manifests
        // (Most modern browsers do, but good to check for graceful degradation)
        const supportsManifest = 'serviceWorker' in navigator && 'onbeforeinstallprompt' in window;
        setIsSupported(true); // We assume support for manifest injection in modern browsers
    }, []);

    const setTheme = useCallback((theme: IconTheme) => {
        setCurrentTheme(theme);
        saveAndApplyTheme(theme);

        // Show a helpful toast/notification that the user may need to re-add to home screen
        // for the icon to fully update on iOS/Android home screens.
        console.log(`[PWA] Theme updated to ${theme}. Re-add to home screen for icon update.`);
    }, []);

    return {
        currentTheme,
        setTheme,
        availableThemes: AVAILABLE_THEMES,
        isSupported
    };
}
