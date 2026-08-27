// =============================================================================
// Utility: Module Federation Dynamic Loader
// Issue: #2729 - Develop a Micro-Frontend Architecture for Club-Specific Mini-Apps
// Description: Handles the dynamic runtime loading of remote Vite Module
// Federation bundles. Injects the remote script, initializes the shared scope
// (React, ReactDOM), and retrieves the exported module.
// =============================================================================

/**
 * Interface for the shared scope we pass to remote apps
 */
export interface MiniAppSharedScope {
  react: any;
  "react-dom": any;
  theme: "light" | "dark";
  userId: string;
  clubId: string;
}

/**
 * Cache to prevent loading the same remote bundle multiple times
 */
const remoteCache = new Map<string, any>();

/**
 * Dynamically loads a remote Module Federation bundle at runtime.
 *
 * @param remoteUrl - The full URL to the remoteEntry.js file
 * @param moduleName - The exposed module name (usually './App' or './Widget')
 * @param sharedScope - The shared dependencies and context to inject
 * @returns The exported React component from the remote app
 */
export async function loadRemoteModule(
  remoteUrl: string,
  moduleName: string,
  sharedScope: MiniAppSharedScope,
): Promise<React.ComponentType<any>> {
  // Check cache first
  const cacheKey = `${remoteUrl}#${moduleName}`;
  if (remoteCache.has(cacheKey)) {
    return remoteCache.get(cacheKey);
  }

  try {
    // 1. Validate URL to prevent XSS/SSRF
    if (!remoteUrl.startsWith("https://") && !remoteUrl.startsWith("http://localhost")) {
      throw new Error("Remote URL must use HTTPS protocol for security.");
    }

    // 2. Extract the unique remote name from the URL
    // e.g., https://cdn.example.com/engineering-club/remoteEntry.js -> engineering_club
    const urlParts = remoteUrl.split("/");
    const fileName = urlParts[urlParts.length - 1];
    const remoteName = fileName.replace(".js", "").replace(/[^a-zA-Z0-9_]/g, "_");

    // 3. Inject the script tag into the DOM
    const existingScript = document.getElementById(`remote-${remoteName}`);
    if (!existingScript) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.id = `remote-${remoteName}`;
        script.src = remoteUrl;
        script.type = "text/javascript";
        script.async = true;

        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load remote entry: ${remoteUrl}`));

        document.head.appendChild(script);
      });
    }

    // 4. Access the global container injected by the remote app
    // Vite Federation exposes the container on window[remoteName]
    const container = (window as any)[remoteName];

    if (!container) {
      throw new Error(`Remote container '${remoteName}' not found on window object.`);
    }

    // 5. Initialize the shared scope (React, ReactDOM, Theme, etc.)
    // This ensures the remote app uses the HOST's React instance (no double loading)
    if (!container.__initialized) {
      await container.init({
        react: {
          [sharedScope.react.version]: {
            get: () => Promise.resolve(() => sharedScope.react),
            loaded: true,
            from: "host",
          },
        },
        "react-dom": {
          [sharedScope.react.version]: {
            get: () => Promise.resolve(() => sharedScope["react-dom"]),
            loaded: true,
            from: "host",
          },
        },
      });
      container.__initialized = true;
    }

    // 6. Retrieve the specific exposed module
    const factory = await container.get(moduleName);
    if (!factory) {
      throw new Error(`Module '${moduleName}' not exposed by remote '${remoteName}'.`);
    }

    const Module = factory();

    // 7. Cache the loaded module
    remoteCache.set(cacheKey, Module.default || Module);

    return Module.default || Module;
  } catch (error: any) {
    console.error("[Federation] Failed to load remote module:", error);
    throw error;
  }
}

/**
 * Clears the remote module cache (useful for hot reloading or logout)
 */
export function clearRemoteCache(): void {
  remoteCache.clear();

  // Optionally remove injected script tags
  const scripts = document.querySelectorAll('script[id^="remote-"]');
  scripts.forEach((script) => script.remove());
}
