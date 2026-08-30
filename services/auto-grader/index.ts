import express from "express";
import cors from "cors";
import Docker from "dockerode";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const app = express();
app.use(cors());
app.use(express.json());

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

app.post("/grade", async (req, res) => {
  const { code, language } = req.body;
  if (!code) return res.status(400).json({ error: "Code is required" });
  if (language !== "python")
    return res.status(400).json({ error: "Only python is supported in this demo" });

  const executionId = crypto.randomUUID();
  const tempDir = path.join("/tmp", `autograder-${executionId}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const scriptPath = path.join(tempDir, "script.py");
  fs.writeFileSync(scriptPath, code);

  let output = "";
  const errorOutput = "";
  let container: Docker.Container | null = null;
  let timeoutHandle: NodeJS.Timeout | null = null;

  try {
    // Spawn Hyper-Isolated Container
    container = await docker.createContainer({
      Image: "python:3.10-alpine",
      Cmd: ["python", "/app/script.py"],
      Tty: false,
      HostConfig: {
        Binds: [`${tempDir}:/app:ro`], // Read-only mount
        NetworkMode: "none", // ZERO Outbound Network Access
        Memory: 64 * 1024 * 1024, // 64MB RAM limit
        CpuShares: 512, // Restricted CPU
        ReadonlyRootfs: true, // Immutability
        PidsLimit: 50, // Fork bomb prevention
      },
    });

    await container.start();

    // Attach stream to capture stdout/stderr
    const stream = await container.logs({ follow: true, stdout: true, stderr: true });

    // Process docker multiplexed stream
    stream.on("data", (chunk: Buffer) => {
      // Docker logs are multiplexed. The 8-byte header defines the stream type and size.
      // For simplicity in this robust demo, we convert to string. Real implementation decodes header.
      const text = chunk
        .toString("utf-8")
        .replace(/[^\x20-\x7E\n]/g, "")
        .trim();
      if (text) output += text + "\n";
    });

    // 10 Second Strict Timeout
    const executionPromise = new Promise((resolve) => {
      stream.on("end", resolve);
    });

    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error("Execution Timeout - Process killed after 10s"));
      }, 10000);
    });

    await Promise.race([executionPromise, timeoutPromise]);

    // Inspect exit code
    const inspectData = await container.inspect();
    const exitCode = inspectData.State.ExitCode;

    res.json({
      success: true,
      execution_id: executionId,
      exit_code: exitCode,
      stdout: output,
      secure: true,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message, execution_id: executionId, stdout: output });
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);

    // Immediate ephemeral cleanup
    if (container) {
      try {
        await container.stop();
      } catch (e) {
        /* Might already be stopped */
      }
      try {
        await container.remove({ force: true });
      } catch (e) {
        console.error("Cleanup error:", e);
      }
    }

    // Delete temp file from host
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

const PORT = process.env.PORT || 4040;
app.listen(PORT, () => {
  console.warn(`Auto-Grader MicroVM orchestrator running on port ${PORT}`);
});
