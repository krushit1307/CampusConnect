import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';

interface LoginCredentials {
    email: string;
    password: string;
}

interface UseLoginReturn {
    /** Function to trigger the login process */
    login: (credentials: LoginCredentials) => Promise<void>;
    /** Current loading state of the login request */
    loading: boolean;
    /** Error message if the login fails */
    error: string | null;
    /** The authenticated user object if login is successful */
    user: User | null;
    /** Number of consecutive failed attempts (used for UI feedback) */
    failedAttempts: number;
    /** Estimated delay in seconds for the next attempt (used for UI feedback) */
    nextDelaySeconds: number;
}

/**
 * useLogin Hook
 * 
 * Manages the user authentication flow by calling the custom Supabase
 * Edge Function `login`. This Edge Function implements a progressive
 * backoff (tarpit) mechanism to protect against brute-force attacks.
 * 
 * This hook tracks the number of failed attempts and the estimated delay
 * for the next attempt, allowing the frontend UI to display warnings or
 * disable the submit button to prevent the user from triggering further
 * exponential delays unnecessarily.
 */
export function useLogin(): UseLoginReturn {
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [failedAttempts, setFailedAttempts] = useState<number>(0);
    const [nextDelaySeconds, setNextDelaySeconds] = useState<number>(0);

    const login = useCallback(async (credentials: LoginCredentials) => {
        setLoading(true);
        setError(null);

        try {
            // Call the custom Edge Function instead of the standard Supabase Auth endpoint
            const { data, error: fnError } = await supabase.functions.invoke('login', {
                body: {
                    email: credentials.email,
                    password: credentials.password,
                },
            });

            if (fnError) {
                throw new Error(fnError.message || 'Login failed');
            }

            // Check if the response contains a specific error payload from our Edge Function
            if (data && data.error) {
                // Update the backoff state based on the server's response
                if (typeof data.failures === 'number') {
                    setFailedAttempts(data.failures);
                }
                if (typeof data.nextDelay === 'number') {
                    setNextDelaySeconds(data.nextDelay / 1000);
                }

                if (data.code === 'MAX_ATTEMPTS_EXCEEDED') {
                    throw new Error('Too many failed attempts. Please try again later or reset your password.');
                }

                throw new Error(data.error);
            }

            // If successful, the Edge Function returns the session data
            if (data && data.session) {
                // Manually set the session in the local Supabase client so the app recognizes the auth state
                const { error: sessionError } = await supabase.auth.setSession({
                    access_token: data.session.access_token,
                    refresh_token: data.session.refresh_token,
                });

                if (sessionError) {
                    throw new Error('Failed to establish local session');
                }

                setUser(data.user);
                setFailedAttempts(0); // Reset attempts on success
                setNextDelaySeconds(0);
            } else {
                throw new Error('Invalid response from authentication server');
            }

        } catch (err: any) {
            console.error('Login error:', err);
            setError(err.message || 'An unexpected error occurred during login.');
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        login,
        loading,
        error,
        user,
        failedAttempts,
        nextDelaySeconds,
    };
}
