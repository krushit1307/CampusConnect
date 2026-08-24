// =============================================================================
// Hook: useTransitionVault
// Issue: #4051 - Implement 'Automated "Club Transition" Document Vault'
// Description: Manages the creation, encryption, and decryption of the 
// transition vault, handling the Web Crypto API interactions and Edge Function calls.
// =============================================================================

import { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { encryptVaultPayload } from '../../lib/crypto/vaultCrypto';

interface UseTransitionVaultReturn {
    isSaving: boolean;
    isDecrypting: boolean;
    error: string | null;
    saveVault: (clubId: string, unlockDate: string, payload: any) => Promise<boolean>;
    decryptVault: (vaultId: string) => Promise<any>;
}

export function useTransitionVault(): UseTransitionVaultReturn {
    const [isSaving, setIsSaving] = useState(false);
    const [isDecrypting, setIsDecrypting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const saveVault = useCallback(async (clubId: string, unlockDate: string, payload: any): Promise<boolean> => {
        setIsSaving(true);
        setError(null);
        try {
            // 1. Encrypt locally
            const masterSecret = import.meta.env.VITE_VAULT_MASTER_SECRET || 'default-dev-secret';
            const { encrypted, iv } = await encryptVaultPayload(payload, masterSecret);

            // 2. Save to database
            const { error: dbErr } = await supabase
                .from('transition_vaults')
                .upsert({
                    club_id: clubId,
                    encrypted_payload: encrypted,
                    iv: iv,
                    unlock_date: unlockDate,
                    unlocked_by_role: 'president'
                }, { onConflict: 'club_id' });

            if (dbErr) throw dbErr;
            return true;
        } catch (err: any) {
            console.error('[useTransitionVault] Save failed:', err);
            setError(err.message || 'Failed to secure the vault.');
            return false;
        } finally {
            setIsSaving(false);
        }
    }, []);

    const decryptVault = useCallback(async (vaultId: string): Promise<any> => {
        setIsDecrypting(true);
        setError(null);
        try {
            const { data, error: fnErr } = await supabase.functions.invoke('decrypt-vault', {
                body: { vault_id: vaultId }
            });

            if (fnErr) throw fnErr;
            if (data.error) throw new Error(data.error);

            return data.payload;
        } catch (err: any) {
            console.error('[useTransitionVault] Decrypt failed:', err);
            setError(err.message || 'Failed to decrypt the vault. Ensure you are the current president and the unlock date has passed.');
            return null;
        } finally {
            setIsDecrypting(false);
        }
    }, []);

    return { isSaving, isDecrypting, error, saveVault, decryptVault };
}
