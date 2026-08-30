// =============================================================================
// Hook: useSecureChat
//Issue: #2905 - Implement 'End-to-End Encryption' for Sensitive Club Direct Messages
//Description: Manages the E2EE lifecycle for a secure channel.Handles 
//fetching the wrapped AES key, unwrapping it with the user's private key, 
//and encrypting / decrypting messages on the fly.
    // =============================================================================

    import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
    decryptMessage,
    encryptMessage,
    unwrapAESKey
} from '../../lib/crypto/e2ee';

export interface SecureMessage {
    id: string;
    channel_id: string;
    sender_id: string;
    ciphertext: string; // Raw ciphertext from DB
    plaintext?: string; // Decrypted locally
    created_at: string;
    is_decrypted: boolean;
    decryption_error?: boolean;
    sender_profile?: {
        full_name: string;
        avatar_url: string;
    };
}

interface UseSecureChatReturn {
    messages: SecureMessage[];
    isLoading: boolean;
    isDecrypting: boolean;
    error: string | null;
    sendMessage: (plaintext: string) => Promise<boolean>;
    hasKeys: boolean;
}

export function useSecureChat(channelId: string, userPrivateKey: CryptoKey | null): UseSecureChatReturn {
    const [messages, setMessages] = useState<SecureMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDecrypting, setIsDecrypting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasKeys, setHasKeys] = useState(false);

    const aesKeyRef = useRef<CryptoKey | null>(null);
    const channelRef = useRef<RealtimeChannel | null>(null);

    // 1. Fetch and unwrap the symmetric AES key for this channel
    useEffect(() => {
        const initSecureChannel = async () => {
            if (!userPrivateKey) {
                setError('Private key not found on this device. Cannot decrypt secure messages.');
                setIsLoading(false);
                return;
            }

            try {
                // Fetch the wrapped AES key for the current user
                const { data: keyRecord, error: keyError } = await supabase
                    .from('secure_channel_keys')
                    .select('encrypted_aes_key')
                    .eq('channel_id', channelId)
                    .single();

                if (keyError || !keyRecord) {
                    throw new Error('You do not have access to this secure channel or keys are missing.');
                }

                // Unwrap the AES key using the device's private RSA key
                const unwrappedKey = await unwrapAESKey(keyRecord.encrypted_aes_key, userPrivateKey);
                aesKeyRef.current = unwrappedKey;
                setHasKeys(true);

                // Now fetch the actual messages
                await fetchMessages();
            } catch (err: any) {
                console.error('[useSecureChat] Init failed:', err);
                setError(err.message);
                setIsLoading(false);
            }
        };

        initSecureChannel();

        // Subscribe to Realtime for new encrypted messages
        const channel = supabase
            .channel(`secure-chat-${channelId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
                async (payload) => {
                    const newMsg = payload.new as any;
                    // Decrypt the incoming message immediately
                    const decrypted = await decryptIncomingMessage(newMsg);
                    setMessages(prev => [...prev, decrypted]);
                }
            )
            .subscribe();

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [channelId, userPrivateKey]);

    const decryptIncomingMessage = async (msg: any): Promise<SecureMessage> => {
        if (!aesKeyRef.current) {
            return { ...msg, is_decrypted: false, decryption_error: true };
        }

        try {
            const plaintext = await decryptMessage(msg.content, aesKeyRef.current);
            return {
                ...msg,
                ciphertext: msg.content,
                plaintext,
                is_decrypted: true,
                decryption_error: false
            };
        } catch (err) {
            return { ...msg, ciphertext: msg.content, is_decrypted: false, decryption_error: true };
        }
    };

    const fetchMessages = async () => {
        setIsLoading(true);
        setIsDecrypting(true);

        try {
            const { data, error: fetchError } = await supabase
                .from('messages')
                .select(`
          id,
          channel_id,
          sender_id,
          content,
          created_at,
          sender_profile:profiles!sender_id (full_name, avatar_url)
        `)
                .eq('channel_id', channelId)
                .eq('is_secure', true)
                .order('created_at', { ascending: true })
                .limit(100); // Limit for performance

            if (fetchError) throw fetchError;

            // Decrypt all messages in parallel
            const decryptedMessages = await Promise.all(
                (data || []).map(msg => decryptIncomingMessage(msg))
            );

            setMessages(decryptedMessages);
        } catch (err: any) {
            console.error('[useSecureChat] Fetch failed:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
            setIsDecrypting(false);
        }
    };

    const sendMessage = async (plaintext: string): Promise<boolean> => {
        if (!aesKeyRef.current || !plaintext.trim()) return false;

        try {
            // 1. Encrypt the message locally
            const ciphertext = await encryptMessage(plaintext, aesKeyRef.current);

            // 2. Send ONLY the ciphertext to the database
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { error: insertError } = await supabase
                .from('messages')
                .insert({
                    channel_id: channelId,
                    sender_id: user.id,
                    content: ciphertext, // Server never sees the plaintext
                    is_secure: true
                });

            if (insertError) throw insertError;

            return true;
        } catch (err: any) {
            console.error('[useSecureChat] Send failed:', err);
            setError(err.message);
            return false;
        }
    };

    return {
        messages,
        isLoading,
        isDecrypting,
        error,
        sendMessage,
        hasKeys
    };
}
