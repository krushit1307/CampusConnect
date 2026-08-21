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

  // Apply any migrations starting with timestamps newer than the last schema snapshot (20260807000000)
  const migrationsDir = path.resolve(__dirname, "../../migrations");
  if (fs.existsSync(migrationsDir)) {
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const newMigrations = files.filter((f) => {
      const match = f.match(/^(\d+)_/);
      if (match) {
        const timestamp = parseFloat(match[1]);
        return timestamp > 20260807999999;
      }
      return false;
    });

    for (const migrationFile of newMigrations) {
      const migrationPath = path.join(migrationsDir, migrationFile);
      const sql = fs.readFileSync(migrationPath, "utf8");
      try {
        await pgClient.query(sql);
        console.log(`✅ [Test Setup] Applied new migration: ${migrationFile}`);
      } catch (e) {
        console.error(`❌ [Test Setup] Failed to apply migration ${migrationFile}:`, e);
        throw e;
      }
    }
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
