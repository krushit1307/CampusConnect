import React, { useEffect, useRef } from "react";
import { useTheme } from "@/components/theme-provider";

export interface SandboxedWidgetProps {
  /** Optional title for the widget card */
  title?: string;
  /** Raw javascript code to execute inside the iframe sandbox */
  bundleCode?: string;
  /** URL to a javascript bundle to execute inside the iframe sandbox */
  bundleUrl?: string;
  /** The ID of the club to expose to the widget via RPC */
  clubId?: string;
  /** Height of the iframe container */
  height?: string | number;
  /** Additional class names for the wrapper */
  className?: string;
}

export function SandboxedWidget({
  title,
  bundleCode,
  bundleUrl,
  clubId,
  height = 300,
  className = "",
}: SandboxedWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const { theme } = useTheme();

  // Initialize the sandboxed iframe and inject the RPC bridge
  useEffect(() => {
    if (!containerRef.current) return;

    // Create Shadow DOM if not exists to completely isolate the widget from global CSS
    let shadowRoot = containerRef.current.shadowRoot;
    if (!shadowRoot) {
      shadowRoot = containerRef.current.attachShadow({ mode: "closed" });
    }

    // Create highly restricted iframe
    const iframe = document.createElement("iframe");
    // CRITICAL: We DO NOT include 'allow-same-origin'.
    // This forces the iframe into a unique origin context ("null"), fully isolating localStorage, cookies, etc.
    iframe.sandbox.add("allow-scripts");

    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    iframeRef.current = iframe;

    // Inject the RPC bridge API so the guest can communicate with the host safely
    const rpcScript = `
      window.CampusConnect = {
        resolvers: {},
        call: function(method, payload) {
          return new Promise((resolve, reject) => {
            const id = Math.random().toString(36).substring(2, 11);
            this.resolvers[id] = { resolve, reject };
            // Send request to the parent window
            window.parent.postMessage({ source: 'campus-connect-widget', id, method, payload }, '*');
          });
        },
        getTheme: function() { return this.call('getTheme'); },
        getClubId: function() { return this.call('getClubId'); },
        getUser: function() { return this.call('getUser'); }
      };

      // Listen for RPC responses from the host
      window.addEventListener('message', (event) => {
        if (event.data && event.data.source === 'campus-connect-host') {
          const { id, error, data } = event.data;
          if (window.CampusConnect.resolvers[id]) {
            if (error) {
              window.CampusConnect.resolvers[id].reject(new Error(error));
            } else {
              window.CampusConnect.resolvers[id].resolve(data);
            }
            delete window.CampusConnect.resolvers[id];
          }
        }
      });
    `;

    // Generate the srcdoc for the iframe.
    // We include standard React libraries since widgets are likely compiled React bundles.
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
          <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
          <style>
            body { 
              margin: 0; 
              font-family: system-ui, -apple-system, sans-serif;
              color: \${theme === 'dark' ? '#fff' : '#000'};
            }
          </style>
        </head>
        <body>
          <div id="root"></div>
          <script>\${rpcScript}</script>
          \${bundleCode ? \`<script>\${bundleCode}</script>\` : ''}
          \${bundleUrl ? \`<script src="\${bundleUrl}"></script>\` : ''}
        </body>
      </html>
    `;

    iframe.srcdoc = htmlContent;

    shadowRoot.innerHTML = "";
    shadowRoot.appendChild(iframe);
  }, [bundleCode, bundleUrl, theme]); // Re-render if bundle or theme (for initial body style) changes

  // Listen for RPC requests from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify the message actually came from our managed iframe.
      // Note: event.origin will be "null" because of the strict sandbox, so we check event.source.
      if (iframeRef.current && event.source === iframeRef.current.contentWindow) {
        if (event.data && event.data.source === "campus-connect-widget") {
          const { id, method } = event.data;

          let responseData = null;
          let responseError = null;

          try {
            switch (method) {
              case "getTheme":
                responseData = theme;
                break;
              case "getClubId":
                responseData = clubId || null;
                break;
              case "getUser":
                // Expose very limited, non-sensitive user data to third-party widgets
                responseData = { isAnonymous: false };
                break;
              default:
                throw new Error("Unknown RPC method: " + method);
            }
          } catch (e: unknown) {
            responseError = e instanceof Error ? e.message : String(e);
          }

          if (iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.postMessage(
              {
                source: "campus-connect-host",
                id,
                data: responseData,
                error: responseError,
              },
              "*",
            );
          }
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [theme, clubId]);

  return (
    <div
      className={`flex flex-col rounded-lg border bg-card text-card-foreground shadow-sm ${className}`}
    >
      {title && (
        <div className="flex flex-col space-y-1.5 p-6 pb-4">
          <h3 className="text-lg font-semibold leading-none tracking-tight">{title}</h3>
        </div>
      )}
      <div
        ref={containerRef}
        style={{ height }}
        className="w-full relative rounded-b-lg overflow-hidden bg-background"
      />
    </div>
  );
}
