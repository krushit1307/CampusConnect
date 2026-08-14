import express from "express";
import { handleWebFinger } from "./webfinger";
import activityPubRouter from "./routes";
import webhookRouter from "./webhook";
import { requestLogger } from "./logging";

interface ActivityPubAppOptions {
  activityPubRouter?: express.Router;
  webhookRouter?: express.Router;
}

export function createActivityPubApp({
  activityPubRouter: routes = activityPubRouter,
  webhookRouter: webhooks = webhookRouter,
}: ActivityPubAppOptions = {}) {
  const app = express();

  app.use(
    express.json({
      type: ["application/json", "application/activity+json", "application/ld+json"],
    }),
  );
  app.use(requestLogger);
  app.get("/.well-known/webfinger", handleWebFinger);
  app.use("/api/activitypub", routes);
  app.use("/api/activitypub", webhooks);
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "activitypub" });
  });

  return app;
}
