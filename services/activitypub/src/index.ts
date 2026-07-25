import express from "express";
import { handleWebFinger } from "./webfinger";
import activityPubRouter from "./routes";
import webhookRouter from "./webhook";

export const DOMAIN = process.env.DOMAIN || "localhost:3002";
const PORT = parseInt(process.env.PORT || "3002", 10);

const app = express();

app.use(
  express.json({
    type: ["application/json", "application/activity+json", "application/ld+json"],
  }),
);

app.get("/.well-known/webfinger", handleWebFinger);

app.use("/api/activitypub", activityPubRouter);
app.use("/api/activitypub", webhookRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "activitypub" });
});

app.listen(PORT, () => {
  console.log(`[ActivityPub] Server running on port ${PORT}`);
  console.log(`[ActivityPub] Domain: ${DOMAIN}`);
  console.log(`[ActivityPub] WebFinger: /.well-known/webfinger`);
  console.log(`[ActivityPub] Actors: /api/activitypub/actors/:slug`);
});
