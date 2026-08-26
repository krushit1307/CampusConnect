type AuthEvent = { type: "LOGOUT" } | { type: "TOKEN_REFRESHED"; payload: { token: string } };

export class SessionManager {
  private static instance: SessionManager;
  private channel: BroadcastChannel;
  public isLeader: boolean = false;

  private onLogoutCallback?: () => void;
  private onTokenUpdateCallback?: (token: string) => void;

  // Private constructor ensures it can only be instantiated from within (Singleton)
  private constructor() {
    this.channel = new BroadcastChannel("campusconnect_auth_sync");
    this.setupChannelListener();
    this.electLeader();
  }

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  // Register callbacks so React hooks can react to background events
  public setCallbacks(onLogout: () => void, onTokenUpdate: (token: string) => void) {
    this.onLogoutCallback = onLogout;
    this.onTokenUpdateCallback = onTokenUpdate;
  }

  private setupChannelListener() {
    this.channel.onmessage = (event: MessageEvent<AuthEvent>) => {
      const data = event.data;
      if (data.type === "LOGOUT") {
        console.log("[SessionManager] Logout received from another tab.");
        this.onLogoutCallback?.();
      } else if (data.type === "TOKEN_REFRESHED") {
        console.log("[SessionManager] New token received from Leader tab.");
        this.onTokenUpdateCallback?.(data.payload.token);
      }
    };
  }

  private electLeader() {
    // Check if the browser supports Web Locks API
    if (typeof navigator !== "undefined" && navigator.locks) {
      // The callback returns a Promise that never resolves.
      // This forces the lock to be held exclusively until this tab is closed.
      navigator.locks
        .request("auth_leader_lock", { mode: "exclusive" }, () => {
          this.isLeader = true;
          console.log("[SessionManager] This tab is now the LEADER.");
          this.startTokenRefreshRoutine();

          return new Promise(() => {}); // Hold lock indefinitely
        })
        .catch((err) => console.error("Leader election failed", err));
    } else {
      console.warn("Web Locks API not supported in this browser.");
    }
  }

  private startTokenRefreshRoutine() {
    // and run `setTimeout` to fetch a new token from Supabase right before it expires.
    // Pseudo-code for where the network request would go:
    /*
      const msUntilExpiry = getMsUntilExpiry();
      setTimeout(async () => {
         const newToken = await fetchNewTokenFromSupabase();
         this.broadcastTokenUpdate(newToken);
      }, msUntilExpiry);
    */
  }

  public broadcastLogout() {
    this.channel.postMessage({ type: "LOGOUT" });
    this.onLogoutCallback?.(); // Execute locally in the tab that triggered it
  }

  public broadcastTokenUpdate(token: string) {
    if (this.isLeader) {
      this.channel.postMessage({ type: "TOKEN_REFRESHED", payload: { token } });
      this.onTokenUpdateCallback?.(token); // Execute locally
    }
  }

  public destroy() {
    this.channel.close();
  }
}
