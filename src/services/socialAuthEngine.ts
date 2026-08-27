/**
 * Social Auth Provider Engine
 * OAuth2 provider schemas, connection status reducers, and redirect URL builders.
 */

export interface SocialAuthProvider {
    id: string;
    name: string;
    providerKey: 'google' | 'github' | 'microsoft' | 'apple';
    isConnected: boolean;
    connectedEmail?: string;
    badgeText?: string;
}

export const MOCK_SOCIAL_PROVIDERS: SocialAuthProvider[] = [
    {
        id: "prov_1",
        name: "Google Workspace",
        providerKey: "google",
        isConnected: true,
        connectedEmail: "student@university.edu",
        badgeText: "Campus Preferred"
    },
    {
        id: "prov_2",
        name: "GitHub Enterprise",
        providerKey: "github",
        isConnected: false,
        badgeText: "Dev Accounts"
    },
    {
        id: "prov_3",
        name: "Microsoft 365",
        providerKey: "microsoft",
        isConnected: false
    },
    {
        id: "prov_4",
        name: "Apple ID",
        providerKey: "apple",
        isConnected: false
    }
];
