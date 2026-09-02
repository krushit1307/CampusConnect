type AuthEvent =
  | { type: "LOGOUT" }
  | { type: "TOKEN_REFRESHED"; payload: { token: string } }
  | { type: "EMERGENCY_LOCK"; payload: { reason: string; duressFlag?: boolean } }
  | { type: "LOCK_RELEASED"; payload: { userId: string } };

export class SessionManager {
  private static instance: SessionManager;
  private channel: BroadcastChannel;
  public isLeader: boolean = false;

  private onLogoutCallback?: () => void;
  private onTokenUpdateCallback?: (token: string) => void;
  private onEmergencyLockCallback?: (reason: string, duressFlag: boolean) => void;
  private onLockReleasedCallback?: (userId: string) => void;

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
  public setCallbacks(
    onLogout: () => void,
    onTokenUpdate: (token: string) => void,
    onEmergencyLock?: (reason: string, duressFlag: boolean) => void,
    onLockReleased?: (userId: string) => void,
  ) {
    this.onLogoutCallback = onLogout;
    this.onTokenUpdateCallback = onTokenUpdate;
    this.onEmergencyLockCallback = onEmergencyLock;
    this.onLockReleasedCallback = onLockReleased;
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
      } else if (data.type === "EMERGENCY_LOCK") {
        console.log("[SessionManager] Emergency lock received from another tab.");
        this.onEmergencyLockCallback?.(data.payload.reason, data.payload.duressFlag ?? false);
      } else if (data.type === "LOCK_RELEASED") {
        console.log("[SessionManager] Lock released received from another tab.");
        this.onLockReleasedCallback?.(data.payload.userId);
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

  /**
   * Broadcasts an emergency lock across all tabs. Call this when the
   * continuous-authentication system detects a critical anomaly.
   */
  public broadcastEmergencyLock(reason: string, duressFlag = false) {
    this.channel.postMessage({ type: "EMERGENCY_LOCK", payload: { reason, duressFlag } });
    this.onEmergencyLockCallback?.(reason, duressFlag);
  }

  /**
   * Broadcasts a lock-release (unlock) across all tabs after successful
   * re-authentication.
   */
  public broadcastLockReleased(userId: string) {
    this.channel.postMessage({ type: "LOCK_RELEASED", payload: { userId } });
    this.onLockReleasedCallback?.(userId);
  }

  public destroy() {
    this.channel.close();
  }
}
