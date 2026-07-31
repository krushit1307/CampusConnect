const { spawn } = require("child_process");
const { WebSocketServer } = require("ws");

const port = process.env.PORT || 3003;
const wss = new WebSocketServer({ port });
console.log(`[LSP Proxy] WebSocket Server listening on port ${port}`);

wss.on("connection", (ws) => {
  console.log("[LSP Proxy] Client connected. Spawning pyright-langserver...");

  // Spawn pyright language server in stdio mode
  const child = spawn("pyright-langserver", ["--stdio"]);

  let buffer = Buffer.alloc(0);

  child.stdout.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (true) {
      const bufferStr = buffer.toString("utf-8");

      // Extract the content length from the LSP header
      const contentLengthMatch = bufferStr.match(/^Content-Length: (\d+)\r\n/i);
      if (!contentLengthMatch) {
        // Clear buffer if it doesn't align with LSP protocol
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

      // Check if we reached the double CRLF indicating end of headers
      const headerEndIndex = bufferStr.indexOf("\r\n\r\n");
      if (headerEndIndex === -1) {
        break;
      }

      const contentLength = parseInt(contentLengthMatch[1], 10);
      const headerLength = headerEndIndex + 4; // Includes \r\n\r\n

      if (buffer.length < headerLength + contentLength) {
        break; // Wait for the rest of the message content
      }

      // Extract raw message payload
      const contentBuf = buffer.slice(headerLength, headerLength + contentLength);
      buffer = buffer.slice(headerLength + contentLength);

      try {
        const payload = contentBuf.toString("utf-8");
        if (ws.readyState === ws.OPEN) {
          ws.send(payload);
        }
      } catch (err) {
        console.error("[LSP Proxy] Error converting content buffer to string:", err);
      }
    }
  });

  child.stderr.on("data", (data) => {
    console.warn("[LSP Server Stderr]:", data.toString("utf-8"));
  });

  child.on("close", (code) => {
    console.log(`[LSP Proxy] Pyright child process exited with code ${code}`);
    if (ws.readyState === ws.OPEN) {
      ws.close();
    }
  });

  ws.on("message", (message) => {
    try {
      // Parse message payload to verify JSON and frame it with LSP headers
      const payloadStr = message.toString("utf-8");
      JSON.parse(payloadStr); // Verification check

      const framed = `Content-Length: ${Buffer.byteLength(payloadStr, "utf-8")}\r\n\r\n${payloadStr}`;

      if (child.stdin.writable) {
        child.stdin.write(framed);
      }
    } catch (err) {
      console.error("[LSP Proxy] Invalid JSON payload from client:", err);
    }
  });

  ws.on("close", () => {
    console.log("[LSP Proxy] Client disconnected. Killing Pyright process...");
    child.kill();
  });

  ws.on("error", (err) => {
    console.error("[LSP Proxy] Client WebSocket error:", err);
    child.kill();
  });
});
