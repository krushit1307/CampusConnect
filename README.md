# CampusConnect: Every club. Every event. One brutally simple OS.

**🗣️ Join our Discord Server for all contributors:** [https://discord.gg/BEMjApACe](https://discord.gg/BEMjApACe)

![License](https://img.shields.io/github/license/krushit1307/CampusConnect?style=flat-square)
![Open Issues](https://img.shields.io/github/issues/krushit1307/CampusConnect?style=flat-square)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)
![Stars](https://img.shields.io/github/stars/krushit1307/CampusConnect?style=flat-square)
![ECSoC 2026](https://img.shields.io/badge/ECSoC-2026-blueviolet?style=flat-square)

CampusConnect solves the chaos of college clubs juggling WhatsApp groups, spreadsheets, and paper certificates. It provides a single, unified platform for students and organizers to manage events, track memberships, and engage with their campus community seamlessly.

<!-- TODO: Add a demo screenshot or Loom link here -->
<!-- ![CampusConnect Demo](./public/demo.gif) -->

## ✨ Features

- **Event Management:** Create, manage, and promote campus events.
- **RSVP + QR Check-in:** Seamless registration and fast, verifiable QR code check-ins.
- **Club Directory:** Discover and join various campus clubs in one centralized place.
- **Discussion Feed:** Engage with the community through club-specific discussion boards.
- **Certificate Generation:** Automatically generate and distribute event certificates.
- **Realtime Updates:** Instant notifications and live updates powered by Supabase Realtime.

## 🛠️ Tech Stack

| Category            | Technology                                   |
| :------------------ | :------------------------------------------- |
| **Frontend**        | Vite, React, TypeScript, Tailwind CSS        |
| **Backend**         | Supabase (Postgres, Auth, Storage, Realtime) |
| **Package Manager** | Bun                                          |

<<<<<<< HEAD
## 🏗️ Architecture / Database

This project uses **Supabase (PostgreSQL)** as its backend database, with Supabase Auth and Row Level Security enabled for access control.

### Core Tables

#### profiles
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key; references Supabase Auth user |
| full_name | Text | User's full name |
| avatar_url | Text | Profile avatar image URL |
| college | Text | College or university name |
| bio | Text | Short biography |
| role | user_role | User role such as `student` or `club_admin` |
| created_at | Timestamp | Profile creation time |
| updated_at | Timestamp | Last profile update time |

#### clubs
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | Text | Club name |
| slug | Text | Unique URL-friendly club identifier |
| description | Text | Club description |
| banner_url | Text | Club banner image URL |
| logo_url | Text | Club logo image URL |
| created_by | UUID | Reference to the profile that created the club |
| created_at | Timestamp | Club creation time |
| updated_at | Timestamp | Last club update time |

#### club_members
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| club_id | UUID | References clubs.id |
| user_id | UUID | References profiles.id |
| role | member_role | Member or admin role |
| status | join_status | Membership status such as pending or approved |
| joined_at | Timestamp | Membership join time |

#### events
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| club_id | UUID | References clubs.id |
| title | Text | Event title |
| description | Text | Event description |
| banner_url | Text | Event banner image URL |
| event_date | Timestamp | Scheduled event date |
| location | Text | Event location |
| created_by | UUID | Reference to the profile that created the event |
| created_at | Timestamp | Event creation time |
| updated_at | Timestamp | Last event update time |

#### event_rsvps
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| event_id | UUID | References events.id |
| user_id | UUID | References profiles.id |
| checked_in | Boolean | Indicates whether the user checked in |
| rsvp_at | Timestamp | RSVP timestamp |

#### posts
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| club_id | UUID | References clubs.id |
| author_id | UUID | References profiles.id |
| content | Text | Post content |
| created_at | Timestamp | Post creation time |
| updated_at | Timestamp | Last post update time |

#### comments
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| post_id | UUID | References posts.id |
| author_id | UUID | References profiles.id |
| content | Text | Comment content |
| created_at | Timestamp | Comment creation time |
| updated_at | Timestamp | Last comment update time |

#### certificates
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| event_id | UUID | References events.id |
| user_id | UUID | References profiles.id |
| certificate_url | Text | Download URL for the certificate |
| issued_at | Timestamp | Certificate issue time |

### Relationships

- One profile can create many clubs, events, posts, comments, and certificates.
- One club can have many members, events, and posts.
- One event can have many RSVPs and certificates.
- One post can have many comments.
- `club_members.club_id` → `clubs.id`
- `club_members.user_id` → `profiles.id`
- `events.club_id` → `clubs.id`
- `event_rsvps.event_id` → `events.id`
- `event_rsvps.user_id` → `profiles.id`
- `posts.club_id` → `clubs.id`
- `posts.author_id` → `profiles.id`
- `comments.post_id` → `posts.id`
- `comments.author_id` → `profiles.id`
- `certificates.event_id` → `events.id`
- `certificates.user_id` → `profiles.id`

### Entity Relationship Diagram (ERD)

```text
profiles ──< clubs >──< club_members >── clubs
  │             │              │
  │             │              └── events ──< event_rsvps
  │             │
  │             └── posts ──< comments
  │
  └── certificates
```

=======
## 🗄️ Architecture / Database

CampusConnect's data lives entirely in Supabase (Postgres). The schema is defined in [`supabase/schema.sql`](./supabase/schema.sql) and centers on **clubs**, the **members**/**events** they run, and the **posts** their members write.

### Entity-relationship diagram

```mermaid
erDiagram
  PROFILES ||--o{ CLUBS : "creates"
  PROFILES ||--o{ CLUB_MEMBERS : "joins as"
  CLUBS ||--o{ CLUB_MEMBERS : "has"
  CLUBS ||--o{ EVENTS : "hosts"
  CLUBS ||--o{ POSTS : "has"
  PROFILES ||--o{ EVENTS : "creates"
  EVENTS ||--o{ EVENT_RSVPS : "receives"
  PROFILES ||--o{ EVENT_RSVPS : "makes"
  PROFILES ||--o{ POSTS : "authors"
  POSTS ||--o{ COMMENTS : "has"
  PROFILES ||--o{ COMMENTS : "authors"
  EVENTS ||--o{ CERTIFICATES : "issues"
  PROFILES ||--o{ CERTIFICATES : "receives"

  PROFILES {
    uuid id PK
    text full_name
    text avatar_url
    text college
    text bio
    enum role "student | club_admin"
  }
  CLUBS {
    uuid id PK
    text name
    text slug UK
    text description
    uuid created_by FK
  }
  CLUB_MEMBERS {
    uuid id PK
    uuid club_id FK
    uuid user_id FK
    enum role "member | admin"
    enum status "pending | approved"
  }
  EVENTS {
    uuid id PK
    uuid club_id FK
    text title
    text description
    timestamptz event_date
    uuid created_by FK
  }
  EVENT_RSVPS {
    uuid id PK
    uuid event_id FK
    uuid user_id FK
    bool checked_in
  }
  POSTS {
    uuid id PK
    uuid club_id FK
    uuid author_id FK
    text content
  }
  COMMENTS {
    uuid id PK
    uuid post_id FK
    uuid author_id FK
    text content
  }
  CERTIFICATES {
    uuid id PK
    uuid event_id FK
    uuid user_id FK
    text certificate_url
  }
```

### Tables

| Table           | Key columns                                                                 | Purpose                                                                 |
| :--------------- | :--------------------------------------------------------------------------- | :------------------------------------------------------------------------ |
| `profiles`       | `id` (PK, = `auth.users.id`), `full_name`, `avatar_url`, `college`, `bio`, `role` | One row per authenticated user; auto-created by the `on_auth_user_created` trigger on signup. |
| `clubs`          | `id` (PK), `name`, `slug` (unique), `description`, `banner_url`, `logo_url`, `created_by` → `profiles.id` | A campus club/society. `slug` is used for the public `/clubs/:slug` route. |
| `club_members`   | `id` (PK), `club_id` → `clubs.id`, `user_id` → `profiles.id`, `role`, `status` | Join table linking users to clubs, with a `member`/`admin` role and a `pending`/`approved` status. Unique per `(club_id, user_id)`. |
| `events`         | `id` (PK), `club_id` → `clubs.id`, `title`, `description`, `event_date`, `location`, `created_by` → `profiles.id` | An event hosted by a club. |
| `event_rsvps`    | `id` (PK), `event_id` → `events.id`, `user_id` → `profiles.id`, `checked_in` | A user's RSVP to an event, plus a `checked_in` flag set on QR check-in. Unique per `(event_id, user_id)`. |
| `posts`          | `id` (PK), `club_id` → `clubs.id`, `author_id` → `profiles.id`, `content` | A discussion post on a club's feed. |
| `comments`       | `id` (PK), `post_id` → `posts.id`, `author_id` → `profiles.id`, `content` | A reply to a post. |
| `certificates`   | `id` (PK), `event_id` → `events.id`, `user_id` → `profiles.id`, `certificate_url` | A generated certificate issued to a user for attending an event. |

### Notes

- All tables have **Row Level Security (RLS)** enabled — see the policies in [`supabase/schema.sql`](./supabase/schema.sql) for exactly who can read/write what (e.g. only club admins can create events, only authors can edit their own posts/comments).
- `posts`, `comments`, and `event_rsvps` are added to the `supabase_realtime` publication, which is what powers the live-updating feed and RSVP counts.
- Storage buckets (`avatars`, `club-banners`, `event-banners`, `certificates`) are public-read, with writes restricted to the authenticated user's own folder.

>>>>>>> origin/main
## 🚀 Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/krushit1307/CampusConnect.git
   cd CampusConnect
   ```
2. **Install dependencies:**
   ```bash
   bun install
   ```
3. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   Fill in your Supabase URL and Anon Key in `.env.local`.
4. **Run database migrations (if applicable):**
   ```bash
   supabase db push
   ```
5. **Start the development server:**
   ```bash
   bun run dev
   ```

## 📁 Project Structure

- `src/` — Contains all frontend React components, pages, hooks, and utilities.
- `supabase/` — Database migrations, seed data, and Edge Functions.
- `public/` — Static assets like images and fonts.

## 🤝 Contributing

We welcome contributions! Please see our [CONTRIBUTING.md](./CONTRIBUTING.md) for details on how to get started. This is an **ECSoC 2026** project, so we are actively looking for contributors. Check out issues labeled `good-first-issue` to begin!

## 🗺️ Roadmap

- **Phase 1:** Core web platform ✅
- **Phase 2:** Contributor feature build (In Progress)
- **Phase 3:** AI layer (Q4 2026) — AI event recommender, AI post summarizer, RAG chatbot via pgvector

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 👤 Maintainer

**Krushit Prajapati** - [GitHub Profile](https://github.com/krushit1307)
