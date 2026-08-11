import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { faker } from "@faker-js/faker";
import inquirer from "inquirer";

// 1. Load environment variables from .env
try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value.trim();
      }
    }
  }
} catch (err) {
  console.warn("Could not load .env file:", err.message);
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in your .env file.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Helper to chunk arrays
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Main seeder function
async function seed() {
  const answers = await inquirer.prompt([
    {
      type: "list",
      name: "size",
      message: "Select the size of the dataset to seed:",
      choices: [
        { name: "Small (20 Users, 4 Clubs, 40 Events, 200 RSVPs)", value: "small" },
        { name: "Medium (50 Users, 10 Clubs, 200 Events, 2000 RSVPs)", value: "medium" },
        { name: "Massive (200 Users, 30 Clubs, 1000 Events, 10000 RSVPs)", value: "massive" },
      ],
    },
  ]);

  const sizes = {
    small: { users: 20, clubs: 4, events: 40, rsvps: 200 },
    medium: { users: 50, clubs: 10, events: 200, rsvps: 2000 },
    massive: { users: 200, clubs: 30, events: 1000, rsvps: 10000 },
  };

  const config = sizes[answers.size];
  console.log(`\nStarting database seed (${answers.size.toUpperCase()} configuration)...`);

  // --- Step 1: Wipe Existing Data ---
  console.log("Wiping existing test data...");
  await supabase.from("event_rsvps").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("comments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("posts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("events").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("club_members").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("clubs").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  const { data: authUsersResult } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (authUsersResult?.users && authUsersResult.users.length > 0) {
    console.log(`Deleting ${authUsersResult.users.length} existing auth users...`);
    await Promise.all(authUsersResult.users.map((u) => supabase.auth.admin.deleteUser(u.id)));
  }

  // --- Step 2: Seed Users ---
  console.log(`Generating ${config.users} Users...`);
  const usersCreated = [];
  const userBatches = chunkArray(Array.from({ length: config.users }), 10);

  for (const batch of userBatches) {
    const promises = batch.map(async () => {
      const email = faker.internet.email().toLowerCase();
      const password = "Password123!";
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();

      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: `${firstName} ${lastName}` },
      });

      if (error) {
        console.error("Failed to create auth user:", error.message);
        return null;
      }
      return { id: data.user.id, firstName, lastName, email };
    });

    const results = await Promise.all(promises);
    usersCreated.push(...results.filter(Boolean));
  }

  console.log(`Updating profiles for ${usersCreated.length} users...`);
  const profileUpdates = usersCreated.map((u, idx) => ({
    id: u.id,
    first_name: u.firstName,
    last_name: u.lastName,
    handle: faker.internet.userName().toLowerCase().replace(/[^a-z0-9_-]/g, "") + idx,
    college: "University of Campus",
    bio: faker.company.catchPhrase(),
  }));

  const { error: profileErr } = await supabase.from("profiles").upsert(profileUpdates);
  if (profileErr) {
    console.error("Failed to update profiles:", profileErr.message);
    process.exit(1);
  }

  // --- Step 3: Seed Clubs ---
  console.log(`Generating ${config.clubs} Clubs...`);
  const clubsToInsert = [];
  for (let i = 0; i < config.clubs; i++) {
    const creator = faker.helpers.arrayElement(usersCreated);
    const name = faker.company.name() + " Club";
    clubsToInsert.push({
      name,
      slug: faker.helpers.slugify(name).toLowerCase() + "-" + i,
      description: faker.lorem.paragraph(),
      created_by: creator.id,
    });
  }

  const { data: clubsCreated, error: clubErr } = await supabase
    .from("clubs")
    .insert(clubsToInsert)
    .select("id, created_by");

  if (clubErr) {
    console.error("Failed to create clubs:", clubErr.message);
    process.exit(1);
  }

  // Seed Club Members
  console.log("Setting up club members...");
  const clubMembers = [];
  for (const club of clubsCreated) {
    // Creator is automatically approved admin
    clubMembers.push({
      club_id: club.id,
      user_id: club.created_by,
      role: "admin",
      status: "approved",
    });

    // Add random members
    const memberCount = faker.number.int({ min: 5, max: 15 });
    const selectedUsers = faker.helpers.arrayElements(usersCreated, Math.min(memberCount, usersCreated.length));
    for (const u of selectedUsers) {
      if (u.id !== club.created_by) {
        clubMembers.push({
          club_id: club.id,
          user_id: u.id,
          role: "member",
          status: "approved",
        });
      }
    }
  }

  const { error: memberErr } = await supabase.from("club_members").insert(clubMembers);
  if (memberErr) {
    console.error("Failed to insert club members:", memberErr.message);
  }

  // --- Step 4: Seed Events ---
  console.log(`Generating ${config.events} Events...`);
  const { data: categories } = await supabase.from("event_categories").select("id, name");
  const defaultCategory = categories?.[0]?.id || null;

  const eventsToInsert = [];
  for (let i = 0; i < config.events; i++) {
    const club = faker.helpers.arrayElement(clubsCreated);
    const category = categories ? faker.helpers.arrayElement(categories).id : defaultCategory;
    const title = faker.company.catchPhrase();
    const eventDate = faker.date.between({
      from: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      to: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });

    eventsToInsert.push({
      club_id: club.id,
      category_id: category,
      title,
      description: faker.lorem.paragraphs(2),
      event_date: eventDate.toISOString(),
      location: faker.location.streetAddress(),
      created_by: club.created_by,
      banner_url: `https://images.unsplash.com/photo-${faker.helpers.arrayElement([
        "1501281668745-f7f57925c3b4",
        "1511578314322-379afb476865",
        "1515187029135-18ee286d815b",
        "1540575467063-178a50c2df87",
        "1475721027785-f74eccf877e2",
      ])}?w=800&auto=format&fit=crop`,
    });
  }

  const { data: eventsCreated, error: eventErr } = await supabase
    .from("events")
    .insert(eventsToInsert)
    .select("id");

  if (eventErr) {
    console.error("Failed to create events:", eventErr.message);
    process.exit(1);
  }

  // --- Step 5: Seed RSVPs ---
  console.log(`Generating ${config.rsvps} RSVPs...`);
  const rsvpsToInsert = [];
  const rsvpPairs = new Set();

  for (let i = 0; i < config.rsvps; i++) {
    const user = faker.helpers.arrayElement(usersCreated);
    const event = faker.helpers.arrayElement(eventsCreated);
    const pairKey = `${user.id}-${event.id}`;

    if (!rsvpPairs.has(pairKey)) {
      rsvpPairs.add(pairKey);
      rsvpsToInsert.push({
        event_id: event.id,
        user_id: user.id,
        checked_in: faker.datatype.boolean(0.4),
        rsvp_at: faker.date.recent().toISOString(),
      });
    }
  }

  const rsvpChunks = chunkArray(rsvpsToInsert, 500);
  let rsvpSuccessCount = 0;

  for (const chunk of rsvpChunks) {
    const { error: rsvpErr } = await supabase.from("event_rsvps").insert(chunk);
    if (rsvpErr) {
      console.error("Failed to insert RSVP batch:", rsvpErr.message);
    } else {
      rsvpSuccessCount += chunk.length;
    }
  }

  console.log(`\n🎉 Seeding complete!`);
  console.log(`- Created ${usersCreated.length} users`);
  console.log(`- Created ${clubsCreated.length} clubs`);
  console.log(`- Created ${eventsCreated.length} events`);
  console.log(`- Created ${rsvpSuccessCount} RSVPs`);
}

seed().catch((err) => {
  console.error("Seeding failed unexpectedly:", err);
  process.exit(1);
});
