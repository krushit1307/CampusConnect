import type { Request, Response } from "express";
import type { WebFingerResponse } from "./types";
import { DOMAIN } from "./config";

export function handleWebFinger(req: Request, res: Response): void {
  const resource = req.query.resource as string;
  if (!resource) {
    res.status(400).json({ error: "Missing resource parameter" });
    return;
  }

  const match = resource.match(/^acct:([^@]+)@(.+)$/);
  if (!match) {
    res.status(400).json({ error: "Invalid resource format. Expected acct:user@domain" });
    return;
  }

  const username = match[1];
  const domain = match[2];

  if (domain !== DOMAIN) {
    res.status(404).json({ error: "Domain not served here" });
    return;
  }

  const response: WebFingerResponse = {
    subject: resource,
    aliases: [`https://${DOMAIN}/api/activitypub/actors/${username}`],
    links: [
      {
        rel: "self",
        type: "application/activity+json",
        href: `https://${DOMAIN}/api/activitypub/actors/${username}`,
      },
      {
        rel: "http://webfinger.net/rel/profile-page",
        type: "text/html",
        href: `https://${DOMAIN}/clubs/${username}`,
      },
    ],
  };

  res.json(response);
}
