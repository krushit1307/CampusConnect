import type { Request, Response, NextFunction } from "express";
import type { HttpSignatureParts } from "./types";

const KEY_ID_PATTERN = /^acct:(.+)@(.+)#main-key$/;

export function parseSignatureHeader(header: string): HttpSignatureParts | null {
  const parts: Record<string, string> = {};
  const regex = /(\w+)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(header)) !== null) {
    parts[match[1]] = match[2];
  }

  if (!parts.keyId || !parts.signature || !parts.headers) return null;

  return {
    keyId: parts.keyId,
    algorithm: parts.algorithm || "rsa-sha256",
    headers: parts.headers.split(" "),
    signature: parts.signature,
  };
}

export function buildSignedString(headers: string[], req: Request): string {
  return headers
    .map((h) => {
      const lower = h.toLowerCase();
      if (lower === "(request-target)") {
        return `(request-target): ${req.method.toLowerCase()} ${req.path}`;
      }
      if (lower === "host") {
        return `host: ${req.hostname}`;
      }
      if (lower === "date") {
        return `date: ${req.headers["date"] || ""}`;
      }
      if (lower === "digest") {
        return `digest: ${req.headers["digest"] || ""}`;
      }
      const val = req.headers[lower];
      return `${lower}: ${Array.isArray(val) ? val[0] : val || ""}`;
    })
    .join("\n");
}

export async function verifyHttpSignature(req: Request): Promise<string | null> {
  const sigHeader = req.headers["signature"] as string;
  if (!sigHeader) return null;

  const parsed = parseSignatureHeader(sigHeader);
  if (!parsed) return null;

  const signedString = buildSignedString(parsed.headers, req);
  const signature = Buffer.from(parsed.signature, "base64");

  try {
    const keyResponse = await fetch(parsed.keyId, {
      headers: { Accept: "application/activity+json" },
    });
    if (!keyResponse.ok) return null;

    const keyDoc = await keyResponse.json();
    const publicKeyPem = keyDoc?.publicKey?.publicKeyPem;
    if (!publicKeyPem) return null;

    const { createVerify } = await import("crypto");
    const verifier = createVerify("RSA-SHA256");
    verifier.update(signedString, "utf8");
    const isValid = verifier.verify(publicKeyPem, signature);

    if (!isValid) return null;

    const actorUrl = keyDoc?.id || keyDoc?.publicKey?.owner;
    return actorUrl || null;
  } catch {
    return null;
  }
}

export function signatureMiddleware(requireAuth = false) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method === "GET") {
      return next();
    }

    const actorId = await verifyHttpSignature(req);

    if (!actorId && requireAuth) {
      res.status(401).json({ error: "Invalid HTTP Signature" });
      return;
    }

    (req as unknown as Record<string, unknown>).verifiedActorId = actorId;
    next();
  };
}
