const { spawn } = require("child_process");
const { WebSocketServer } = require("ws");

const port = process.env.PORT || 3003;
const wss = new WebSocketServer({ port });
console.log(`[LSP Proxy] WebSocket Server listening on port ${port}`);

// Shared LSP Process State
let sharedProcess = null;
let serverCapabilities = null;
const clients = new Map();
let clientIdCounter = 1;

function frameLspMessage(payloadObj) {
  const payloadStr = JSON.stringify(payloadObj);
  return `Content-Length: ${Buffer.byteLength(payloadStr, "utf-8")}\r\n\r\n${payloadStr}`;
}

function spawnSharedProcess() {
  console.log("[LSP Proxy] Spawning shared pyright-langserver process...");
  sharedProcess = spawn("pyright-langserver", ["--stdio"]);

  let buffer = Buffer.alloc(0);

  sharedProcess.stdout.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (true) {
      const bufferStr = buffer.toString("utf-8");
      const contentLengthMatch = bufferStr.match(/^Content-Length: (\d+)\r\n/i);

      if (!contentLengthMatch) {
        if (
          bufferStr.length > 0 &&
          !bufferStr.startsWith("Content-Length:") &&
          !bufferStr.startsWith("Content-")
        ) {
          console.warn("[LSP Proxy] Flushing unexpected stream data:", bufferStr);
          buffer = Buffer.alloc(0);
        }
        break;
      }

      const headerEndIndex = bufferStr.indexOf("\r\n\r\n");
      if (headerEndIndex === -1) {
        break;
      }

      const contentLength = parseInt(contentLengthMatch[1], 10);
      const headerLength = headerEndIndex + 4;

      if (buffer.length < headerLength + contentLength) {
        break;
      }

      const contentBuf = buffer.slice(headerLength, headerLength + contentLength);
      buffer = buffer.slice(headerLength + contentLength);

      try {
        const payloadStr = contentBuf.toString("utf-8");
        const message = JSON.parse(payloadStr);

        handleServerMessage(message, payloadStr);
      } catch (err) {
        console.error("[LSP Proxy] Error parsing server message:", err);
      }
    }
  });

  sharedProcess.stderr.on("data", (data) => {
    console.warn("[LSP Server Stderr]:", data.toString("utf-8"));
  });

  sharedProcess.on("close", (code) => {
    console.log(`[LSP Proxy] Shared process exited with code ${code}`);
    sharedProcess = null;
    serverCapabilities = null;
    // Close all clients
    for (const ws of clients.values()) {
      if (ws.readyState === ws.OPEN) ws.close();
    }
    clients.clear();
  });
}

function handleServerMessage(message, originalPayloadStr) {
  // If it's a response to a request
  if (message.id !== undefined && typeof message.id === "string" && message.id.includes(":")) {
    const colonIdx = message.id.indexOf(":");
    const clientIdStr = message.id.substring(0, colonIdx);
    const originalId = message.id.substring(colonIdx + 1);

    // Parse originalId back to number if it was one
    message.id = isNaN(Number(originalId)) ? originalId : Number(originalId);

    // If this was the first initialize response, cache the capabilities
    if (message.result && message.result.capabilities && !serverCapabilities) {
      console.log("[LSP Proxy] Cached server capabilities.");
      serverCapabilities = message.result.capabilities;
    }

    const clientId = parseInt(clientIdStr, 10);
    const ws = clients.get(clientId);
    if (ws && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  } else {
    // It's a notification from the server (e.g., diagnostics) or unmapped request
    // Broadcast to all clients. Clients will ignore URIs they don't care about.
    const payloadStr = JSON.stringify(message);
    for (const ws of clients.values()) {
      if (ws.readyState === ws.OPEN) {
        ws.send(payloadStr);
      }
    }
  }
}

wss.on("connection", (ws) => {
  const clientId = clientIdCounter++;
  clients.set(clientId, ws);
  console.log(`[LSP Proxy] Client ${clientId} connected. Total clients: ${clients.size}`);

  if (!sharedProcess) {
    spawnSharedProcess();
  }

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString("utf-8"));

      if (message.method === "initialize") {
        if (serverCapabilities) {
          // Already initialized, synthesize response
          console.log(`[LSP Proxy] Synthesizing initialize response for client ${clientId}`);
          const syntheticResponse = {
            jsonrpc: "2.0",
            id: message.id,
            result: {
              capabilities: serverCapabilities,
              serverInfo: { name: "pyright-multiplexed" },
            },
          };
          ws.send(JSON.stringify(syntheticResponse));

          // Dynamically add workspace folder if provided
          if (
            message.params &&
            message.params.workspaceFolders &&
            message.params.workspaceFolders.length > 0
          ) {
            const addWorkspaceNotification = {
              jsonrpc: "2.0",
              method: "workspace/didChangeWorkspaceFolders",
              params: {
                event: {
                  added: message.params.workspaceFolders,
                  removed: [],
                },
              },
            };
            if (sharedProcess && sharedProcess.stdin.writable) {
              sharedProcess.stdin.write(frameLspMessage(addWorkspaceNotification));
            }
          }
          return;
        }
      }

      // Rewrite request IDs to route them back correctly
      if (message.id !== undefined) {
        message.id = `${clientId}:${message.id}`;
      }

      if (sharedProcess && sharedProcess.stdin.writable) {
        sharedProcess.stdin.write(frameLspMessage(message));
      }
    } catch (err) {
      console.error(`[LSP Proxy] Client ${clientId} sent invalid JSON:`, err);
    }
  });

  ws.on("close", () => {
    console.log(`[LSP Proxy] Client ${clientId} disconnected.`);
    clients.delete(clientId);

    // Optional: if no clients left, we could kill the shared process to save resources
    if (clients.size === 0 && sharedProcess) {
      console.log("[LSP Proxy] No clients connected. Shutting down shared process...");
      sharedProcess.kill();
      sharedProcess = null;
      serverCapabilities = null;
    }
  });

  ws.on("error", (err) => {
    console.error(`[LSP Proxy] Client ${clientId} error:`, err);
  });
});
