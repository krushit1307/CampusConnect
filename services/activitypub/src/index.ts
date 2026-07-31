import express from "express";
import { handleWebFinger } from "./webfinger";
import activityPubRouter from "./routes";
import webhookRouter from "./webhook";
import { logger } from "./logger";
import { requestLogger } from "./logging";

export const DOMAIN = process.env.DOMAIN || "localhost:3002";
const PORT = parseInt(process.env.PORT || "3002", 10);

const app = express();

app.use(
  express.json({
    type: ["application/json", "application/activity+json", "application/ld+json"],
  }),
);

app.use(requestLogger);

app.get("/.well-known/webfinger", handleWebFinger);

app.use("/api/activitypub", activityPubRouter);
app.use("/api/activitypub", webhookRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "activitypub" });
});

app.listen(PORT, () => {
  logger.info(
    {
      port: PORT,
      domain: DOMAIN,
      webfinger: "/.well-known/webfinger",
      actors: "/api/activitypub/actors/:slug",
    },
    "ActivityPub server listening",
  );
});
