import { beforeAll, afterAll, beforeEach } from "vitest";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Client } from "pg";
import fs from "fs";
import path from "path";

let postgresContainer: StartedPostgreSqlContainer;
let pgClient: Client;

beforeAll(async () => {
  // Use supabase/postgres image to ensure compatibility with Supabase extensions (pgvector, postgis, etc.)
  postgresContainer = await new PostgreSqlContainer("supabase/postgres:15.1.0.147")
    .withDatabase("postgres")
    .withUsername("postgres")
    .withPassword("postgres")
    .start();

  const uri = postgresContainer.getConnectionUri();
  process.env.DATABASE_URL = uri;
  // Fallback for tests that might expect SUPABASE_DB_URL directly
  process.env.SUPABASE_DB_URL = uri;

  // Connect to the DB to run schema migrations
  pgClient = new Client({ connectionString: uri });
  await pgClient.connect();

  // Run the schema.sql to build the database schema programmatically
  const schemaPath = path.resolve(__dirname, "../../schema.sql");
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, "utf8");
    try {
      await pgClient.query(schemaSql);
      console.log("✅ [Test Setup] Schema applied successfully to Testcontainer.");
    } catch (e) {
      console.error("❌ [Test Setup] Failed to apply schema:", e);
      throw e;
    }
  } else {
    console.warn("⚠️ [Test Setup] schema.sql not found at", schemaPath);
  }
}, 120000); // Give it enough time to pull the image and boot up

beforeEach(async () => {
  if (pgClient) {
    // Truncate all tables in the public schema to ensure isolation between tests.
    // CASCADE ensures that foreign key relationships are respected during truncation.
    const query = `
      DO $$ DECLARE
          r RECORD;
      BEGIN
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
              EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE;';
          END LOOP;
      END $$;
    `;
    await pgClient.query(query);
  }
});

afterAll(async () => {
  if (pgClient) {
    await pgClient.end();
  }
  if (postgresContainer) {
    await postgresContainer.stop();
  }
});
