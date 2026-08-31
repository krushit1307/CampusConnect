'use client';

import { useEffect } from 'react';
import Script from 'next/script';

export default function RecaptchaProvider() {
  useEffect(() => {
    // Ensure reCAPTCHA is loaded globally
    if (typeof window !== 'undefined' && !(window as any).grecaptcha) {
      console.warn('reCAPTCHA script failed to load');
    }
  }, []);

  return (
    <Script
      src={`https://www.google.com/recaptcha/api.js?render=${process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}`}
      strategy="afterInteractive"
    />
  );
}
