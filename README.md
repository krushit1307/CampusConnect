# CampusConnect: Every club. Every event. One brutally simple OS.

![License](https://img.shields.io/github/license/krushit1307/CampusConnect?style=flat-square)
![Open Issues](https://img.shields.io/github/issues/krushit1307/CampusConnect?style=flat-square)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)
![Stars](https://img.shields.io/github/stars/krushit1307/CampusConnect?style=flat-square)
![ECSoC 2026](https://img.shields.io/badge/ECSoC-2026-blueviolet?style=flat-square)
[![CodeRabbit Assured](https://img.shields.io/badge/CodeRabbit-Assured-green?style=flat-square)](https://coderabbit.ai)

CampusConnect solves the chaos of college clubs juggling WhatsApp groups, spreadsheets, and paper certificates. It provides a single, unified platform for students and organizers to manage events, track memberships, and engage with their campus community seamlessly.

<!-- TODO: Add a demo screenshot or Loom link here -->
<!-- ![CampusConnect Demo](./public/demo.gif) -->

## ✨ Features
* **Event Management:** Create, manage, and promote campus events.
* **RSVP + QR Check-in:** Seamless registration and fast, verifiable QR code check-ins.
* **Club Directory:** Discover and join various campus clubs in one centralized place.
* **Discussion Feed:** Engage with the community through club-specific discussion boards.
* **Certificate Generation:** Automatically generate and distribute event certificates.
* **Realtime Updates:** Instant notifications and live updates powered by Supabase Realtime.

## 🛠️ Tech Stack
| Category | Technology |
| :--- | :--- |
| **Frontend** | Vite, React, TypeScript, Tailwind CSS |
| **Backend** | Supabase (Postgres, Auth, Storage, Realtime) |
| **Package Manager** | Bun |

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
* `src/` — Contains all frontend React components, pages, hooks, and utilities.
* `supabase/` — Database migrations, seed data, and Edge Functions.
* `public/` — Static assets like images and fonts.

## 🤝 Contributing
We welcome contributions! Please see our [CONTRIBUTING.md](./CONTRIBUTING.md) for details on how to get started. This is an **ECSoC 2026** project, so we are actively looking for contributors. Check out issues labeled `good-first-issue` to begin!

## 🗺️ Roadmap
* **Phase 1:** Core web platform ✅
* **Phase 2:** Contributor feature build (In Progress)
* **Phase 3:** AI layer (Q4 2026) — AI event recommender, AI post summarizer, RAG chatbot via pgvector

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 👤 Maintainer
**Krushit Prajapati** - [GitHub Profile](https://github.com/krushit1307)
