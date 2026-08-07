// =============================================================================
// Test Suite: WebSocket Contract Tests
// Issue: #2410 - Exhaustive Contract Tests for WebSocket / Socket.io JSON schemas
// Description: Automated integration tests that physically connect a headless
// WebSocket client to the server and assert that emitted JSON payloads match
// the exact Zod schema expected by the frontend.
// =============================================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "http";
import { Server } from "socket.io";
import Client from "socket.io-client";
import {
  WebSocketContracts,
  ChatMessageSchema,
  TypingIndicatorSchema,
  UserJoinedSchema,
} from "../contracts/websocket-schemas";

describe("WebSocket Contract Tests", () => {
  let io: Server;
  let httpServer: any;
  let clientSocket: any;
  let serverPort: number;

  beforeAll(async () => {
    // Step 1: Instantiate a real Node.js HTTP server
    httpServer = createServer();

    // Step 2: Attach Socket.io server to it
    io = new Server(httpServer, {
      cors: { origin: "*" },
    });

    // Step 3: Simulate backend controller logic for emission
    io.on("connection", (socket) => {
      socket.on("send_chat_message", (data) => {
        // Backend emits chat_message event
        // INTENTIONAL BUG SCENARIO: If developer renames 'author' to 'userId',
        // the test below will catch it
        socket.emit("chat_message", {
          id: data.id,
          text: data.text,
          author: data.author, // CRITICAL FIELD
          timestamp: new Date().toISOString(),
          roomId: data.roomId,
        });
      });

      socket.on("start_typing", (data) => {
        socket.emit("typing_indicator", {
          userId: data.userId,
          roomId: data.roomId,
          isTyping: true,
          timestamp: new Date().toISOString(),
        });
      });

      socket.on("join_room", (data) => {
        socket.emit("user_joined", {
          userId: data.userId,
          username: data.username,
          avatarUrl: data.avatarUrl,
          roomId: data.roomId,
          joinedAt: new Date().toISOString(),
        });
      });
    });

    // Start server on random port
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        serverPort = httpServer.address().port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    // Step 6: Close the server and disconnect the client
    io.close();
    httpServer.close();
    if (clientSocket) {
      clientSocket.disconnect();
    }
  });

  beforeEach(() => {
    // Step 2: Utilize socket.io-client to create a fake headless client
    clientSocket = Client(`http://localhost:${serverPort}`, {
      transports: ["websocket"],
    });
  });

  afterEach(() => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
  });

  /**
   * Helper: Wrap event listener in a strict Promise wrapper that explicitly
   * rejects if the event isn't received within 500ms to prevent test hanging
   */
  const waitForEvent = (eventName: string, timeout = 500): Promise<any> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout: Event '${eventName}' not received within ${timeout}ms`));
      }, timeout);

      clientSocket.once(eventName, (payload: any) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
  };

  it("should emit chat_message payload that matches Frontend Zod schema", async () => {
    // Step 3: Write the test
    const payloadPromise = waitForEvent("chat_message");

    // Step 4: Trigger the backend controller logic
    clientSocket.emit("send_chat_message", {
      id: "123e4567-e89b-12d3-a456-426614174000",
      text: "Hello CampusConnect!",
      author: "987fcdeb-51a2-43d7-9012-3456789abcde",
      roomId: "550e8400-e29b-41d4-a716-446655440000",
    });

    // Step 5: Headless client intercepts broadcast and validates schema
    const payload = await payloadPromise;

    // This will throw if 'author' field is missing or renamed
    const result = ChatMessageSchema.safeParse(payload);
    expect(result.success).toBe(true);

    if (!result.success) {
      console.error("Schema validation failed:", result.error.format());
    }
  });

  it("should emit typing_indicator payload that matches Frontend Zod schema", async () => {
    const payloadPromise = waitForEvent("typing_indicator");

    clientSocket.emit("start_typing", {
      userId: "987fcdeb-51a2-43d7-9012-3456789abcde",
      roomId: "550e8400-e29b-41d4-a716-446655440000",
    });

    const payload = await payloadPromise;
    const result = TypingIndicatorSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("should emit user_joined payload that matches Frontend Zod schema", async () => {
    const payloadPromise = waitForEvent("user_joined");

    clientSocket.emit("join_room", {
      userId: "987fcdeb-51a2-43d7-9012-3456789abcde",
      username: "TestStudent",
      avatarUrl: "https://example.com/avatar.jpg",
      roomId: "550e8400-e29b-41d4-a716-446655440000",
    });

    const payload = await payloadPromise;
    const result = UserJoinedSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("should fail validation if backend emits malformed chat_message (Contract Breach Test)", async () => {
    // Simulate a bug where backend deletes the 'author' field
    io.emit("chat_message", {
      id: "123e4567-e89b-12d3-a456-426614174000",
      text: "Missing author field!",
      // author field is intentionally missing
      timestamp: new Date().toISOString(),
      roomId: "550e8400-e29b-41d4-a716-446655440000",
    });

    const payloadPromise = waitForEvent("chat_message");
    const payload = await payloadPromise;

    const result = ChatMessageSchema.safeParse(payload);

    // Test should instantly catch the missing field and fail
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("author"))).toBe(true);
    }
  });

  it("should validate all registered WebSocket contracts exist", () => {
    // Verify all expected events are registered
    expect(WebSocketContracts).toHaveProperty("chat_message");
    expect(WebSocketContracts).toHaveProperty("typing_indicator");
    expect(WebSocketContracts).toHaveProperty("user_joined");
    expect(WebSocketContracts).toHaveProperty("user_left");
    expect(WebSocketContracts).toHaveProperty("event_update");
  });
});
