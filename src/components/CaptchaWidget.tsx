import { useEffect, useId, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
    hcaptcha?: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
    };
  }
}

interface CaptchaWidgetProps {
  siteKey?: string;
  provider?: "turnstile" | "hcaptcha";
  onToken: (token?: string) => void;
  onError?: () => void;
  onExpire?: () => void;
}

export function CaptchaWidget({
  siteKey,
  provider,
  onToken,
  onError,
  onExpire,
}: CaptchaWidgetProps) {
  const containerId = useId();
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey || !provider) {
      onToken(undefined);
      return;
    }

    const renderWidget = () => {
      const container = document.getElementById(containerId);
      if (!container) return;

      if (provider === "turnstile") {
        widgetIdRef.current = window.turnstile?.render(container, {
          sitekey: siteKey,
          callback: (token: string) => onToken(token),
          "expired-callback": () => {
            onToken(undefined);
            onExpire?.();
          },
          "error-callback": () => {
            onToken(undefined);
            onError?.();
          },
          theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
        });
        return;
      }

      widgetIdRef.current = window.hcaptcha?.render(container, {
        sitekey: siteKey,
        callback: (token: string) => onToken(token),
        "expired-callback": () => {
          onToken(undefined);
          onExpire?.();
        },
        "error-callback": () => {
          onToken(undefined);
          onError?.();
        },
        theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
      });
    };

    const scriptId = provider === "turnstile" ? "turnstile-script" : "hcaptcha-script";
    const existingScript = document.getElementById(scriptId);

    if (existingScript) {
      if (window.turnstile || window.hcaptcha) {
        renderWidget();
      } else {
        existingScript.addEventListener("load", renderWidget, { once: true });
      }
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src =
      provider === "turnstile"
        ? "https://challenges.cloudflare.com/turnstile/v0/api.js"
        : "https://js.hcaptcha.com/1/api.js";
    script.async = true;
    script.defer = true;
    script.onload = () => renderWidget();
    script.onerror = () => {
      onToken(undefined);
      onError?.();
    };
    document.body.appendChild(script);

    return () => {
      if (widgetIdRef.current) {
        if (provider === "turnstile") {
          window.turnstile?.remove(widgetIdRef.current);
        }
      }
    };
  }, [containerId, onError, onExpire, onToken, provider, siteKey]);

  if (!siteKey || !provider) {
    return null;
  }

  return <div id={containerId} className="flex items-center justify-start" />;
}
