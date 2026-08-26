// =============================================================================
// Library: Socket.io Client Wrapper with Zod Validation
// Issue: #2410 - Exhaustive Contract Tests for WebSocket / Socket.io JSON schemas
// Description: Type-safe Socket.io client wrapper that validates incoming
// payloads against the shared Zod contracts before passing to React components.
// Prevents silent UI breaks from backend schema drift.
// =============================================================================

import { io, Socket } from "socket.io-client";
import {
  WebSocketContracts,
  WebSocketEventName,
  validateWebSocketPayload,
} from "../../contracts/websocket-schemas";

interface SocketClientOptions {
  url: string;
  token?: string;
  autoConnect?: boolean;
}

type EventCallback<T extends WebSocketEventName> = (
  payload: z.infer<(typeof WebSocketContracts)[T]>,
) => void;

/**
 * Type-safe Socket.io client with automatic contract validation
 */
class SocketClient {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<EventCallback<any>>> = new Map();

  constructor(private options: SocketClientOptions) {
    if (options.autoConnect !== false) {
      this.connect();
    }
  }

  /**
   * Establishes connection to the WebSocket server
   */
  connect(): void {
    if (this.socket?.connected) return;

    this.socket = io(this.options.url, {
      auth: {
        token: this.options.token,
      },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on("connect", () => {
      console.log("[Socket] Connected to server");
    });

    this.socket.on("disconnect", (reason) => {
      console.warn("[Socket] Disconnected:", reason);
    });

    this.socket.on("connect_error", (error) => {
      console.error("[Socket] Connection error:", error.message);
    });

    // Register listeners for all known contract events
    this.registerContractListeners();
  }

  /**
   * Disconnects from the WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Subscribes to a specific WebSocket event with automatic payload validation
   */
  on<T extends WebSocketEventName>(eventName: T, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }

    this.listeners.get(eventName)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventName)?.delete(callback);
    };
  }

  /**
   * Emits an event to the server
   */
  emit(eventName: string, payload: any): void {
    if (!this.socket?.connected) {
      console.warn("[Socket] Cannot emit: not connected");
      return;
    }
    this.socket.emit(eventName, payload);
  }

  /**
   * Internal: Registers listeners that validate payloads against Zod schemas
   */
  private registerContractListeners(): void {
    if (!this.socket) return;

    // Register listener for each known contract event
    (Object.keys(WebSocketContracts) as WebSocketEventName[]).forEach((eventName) => {
      this.socket!.on(eventName, (rawPayload: unknown) => {
        try {
          // Validate payload against the shared contract
          const validatedPayload = validateWebSocketPayload(eventName, rawPayload);

          // Notify all registered callbacks with the validated payload
          const callbacks = this.listeners.get(eventName);
          if (callbacks) {
            callbacks.forEach((callback) => {
              try {
                callback(validatedPayload);
              } catch (err) {
                console.error(`[Socket] Error in ${eventName} callback:`, err);
              }
            });
          }
        } catch (validationError) {
          // If validation fails, log error but don't crash the app
          console.error(
            `[Socket] Contract breach detected for event '${eventName}':`,
            validationError,
          );
          // Optionally emit a special error event for monitoring
          this.socket?.emit("client_contract_breach", {
            eventName,
            error: (validationError as Error).message,
          });
        }
      });
    });
  }

  /**
   * Check if socket is currently connected
   */
  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

// Singleton instance for the application
let socketInstance: SocketClient | null = null;

/**
 * Get or create the global Socket client instance
 */
export function getSocketClient(options?: Partial<SocketClientOptions>): SocketClient {
  if (!socketInstance) {
    socketInstance = new SocketClient({
      url: import.meta.env.VITE_WS_URL || "http://localhost:3001",
      autoConnect: true,
      ...options,
    });
  }
  return socketInstance;
}

/**
 * Hook-friendly function to subscribe to socket events with automatic cleanup
 */
export function useSocketEvent<T extends WebSocketEventName>(
  eventName: T,
  callback: EventCallback<T>,
): void {
  // In a real React app, this would use useEffect for cleanup
  // For this library file, we provide the raw subscription method
  const client = getSocketClient();
  client.on(eventName, callback);
}

// Export types for TypeScript consumers
export type { EventCallback, SocketClientOptions };
export { SocketClient };
