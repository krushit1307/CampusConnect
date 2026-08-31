/**
 * reCAPTCHA v3 Integration Utilities
 * Handles token generation on the client and verification on the server.
 */

/**
 * Executes reCAPTCHA v3 and returns a token for the specified action.
 * 
 * @param action - The action being performed (e.g., 'rsvp')
 * @returns Promise<string> - The reCAPTCHA token
 */
export async function getRecaptchaToken(action: string): Promise<string> {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined' || !(window as any).grecaptcha) {
            reject(new Error('reCAPTCHA not loaded'));
            return;
        }

        (window as any).grecaptcha.ready(() => {
            (window as any).grecaptcha.execute(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY, { action })
                .then((token: string) => resolve(token))
                .catch((error: Error) => reject(error));
        });
    });
}

/**
 * Verifies a reCAPTCHA token with Google's servers.
 * 
 * @param token - The reCAPTCHA token to verify
 * @param ip - The requester's IP address
 * @returns Promise<RecaptchaVerificationResponse>
 */
export async function verifyRecaptchaToken(token: string, ip: string) {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    const url = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}&remoteip=${ip}`;

    const response = await fetch(url, { method: 'POST' });
    const data = await response.json();

    return {
        success: data.success,
        score: data.score || 0,
        action: data.action,
        challenge_ts: data.challenge_ts,
        hostname: data.hostname,
    };
}
