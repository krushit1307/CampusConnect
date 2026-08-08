import { createActivityPubApp } from "./app";
import { DOMAIN, PORT } from "./config";
import { logger } from "./logger";

export { DOMAIN } from "./config";

export const app = createActivityPubApp();

if (process.env.NODE_ENV !== "test") {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    logger.fatal("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
    process.exit(1);
  }

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
}
