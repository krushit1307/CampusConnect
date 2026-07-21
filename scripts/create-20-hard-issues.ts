import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (!fs.existsSync(envPath)) {
  console.error("❌ .env.local file not found.");
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, "utf-8");
const githubTokenMatch = envContent.match(/GITHUB_TOKEN=(.*)/);
const githubRepoMatch = envContent.match(/GITHUB_REPO=(.*)/);

const GITHUB_TOKEN = githubTokenMatch ? githubTokenMatch[1].trim() : null;
const GITHUB_REPO = githubRepoMatch ? githubRepoMatch[1].trim() : null;

const API_BASE = `https://api.github.com/repos/${GITHUB_REPO}`;

const headers = {
  Authorization: `token ${GITHUB_TOKEN}`,
  Accept: "application/vnd.github.v3+json",
  "User-Agent": "CampusConnect-Issues-Script",
};

async function githubRequest(endpoint: string, method: string = "GET", body?: unknown) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: {
      ...headers,
      ...(body && { "Content-Type": "application/json" }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) return null;
  if (response.status === 204) return true;
  return await response.json();
}

const hardIssues = [
  {
    title: "Implement a WebRTC-based 1-on-1 video call feature for club members",
    body: "## 📋 Summary\nBuild a decentralized peer-to-peer video calling feature directly into the app using WebRTC, utilizing Supabase Realtime for the initial SDP signaling process.\n\n## 🎯 Background\nClub members need a way to conduct quick remote meetings without generating Zoom links.\n\n## ✅ Acceptance Criteria\n- [ ] Implement RTCPeerConnection and handle ICE candidates.\n- [ ] Use Supabase Realtime Channels for signaling (offer/answer).\n- [ ] Handle network NAT traversal utilizing a public STUN/TURN server.\n\n## 🗂️ Files to Modify\n- `src/components/VideoCall/WebRTCProvider.tsx`\n- `src/hooks/useSignaling.ts`",
    labels: ["ECSoC26", "good-backend"]
  },
  {
    title: "Build an AST-based static analysis tool to enforce architectural boundaries",
    body: "## 📋 Summary\nWrite a custom ESLint plugin using Abstract Syntax Trees (AST) that strictly prevents components in `src/pages` from directly importing from other pages, enforcing a strict unidirectional dependency graph.\n\n## 🎯 Background\nAs the codebase scales, accidental circular dependencies and spaghetti imports degrade maintainability.\n\n## ✅ Acceptance Criteria\n- [ ] Create a custom ESLint rule utilizing `eslint-plugin-local-rules`.\n- [ ] Parse import declarations and fail CI if a forbidden import path is detected.\n- [ ] Publish the rule or run it in the Husky pre-commit hook.\n\n## 🗂️ Files to Modify\n- `tools/eslint-rules/no-cross-page-imports.js`\n- `.eslintrc.cjs`",
    labels: ["ECSoC26", "good-pr"]
  },
  {
    title: "Design and implement a CRDT engine for real-time collaborative document editing",
    body: "## 📋 Summary\nImplement Conflict-free Replicated Data Types (CRDTs) using Yjs or Automerge to allow multiple club admins to edit event descriptions simultaneously without overwriting each other.\n\n## 🎯 Background\nCurrently, if two admins edit an event, the last write wins (data loss). True collaboration requires operational transformation or CRDTs.\n\n## ✅ Acceptance Criteria\n- [ ] Integrate Yjs with a rich text editor (e.g., Tiptap).\n- [ ] Sync document deltas via Supabase Realtime Websockets.\n- [ ] Handle conflict resolution and offline syncing seamlessly.\n\n## 🗂️ Files to Modify\n- `src/components/Editor/CollaborativeEditor.tsx`\n- `supabase/functions/crdt-sync/index.ts`",
    labels: ["ECSoC26", "good-backend"]
  },
  {
    title: "Create a custom WebAssembly (Wasm) module in Rust for client-side image compression",
    body: "## 📋 Summary\nWrite a Rust library to compress user avatars and event banners using the MozJPEG algorithm, compile it to WebAssembly, and execute it in the browser before upload.\n\n## 🎯 Background\nUploading raw 10MB images from phones destroys bandwidth and storage. JS-based compression is too slow on the main thread.\n\n## ✅ Acceptance Criteria\n- [ ] Write a Rust function utilizing `image` crate to resize and compress.\n- [ ] Compile to `wasm-pack` and integrate via a Web Worker.\n- [ ] Hook the Wasm module into the FileUpload component pipeline.\n\n## 🗂️ Files to Modify\n- `wasm/image-compressor/src/lib.rs`\n- `src/workers/compress.worker.ts`",
    labels: ["ECSoC26", "good-pr"]
  },
  {
    title: "Migrate monolithic React application to a Micro-frontend architecture",
    body: "## 📋 Summary\nRefactor the build system to use Webpack Module Federation, splitting the app into distinct host and remote applications (e.g., Feed App, Events App, Dashboard App).\n\n## 🎯 Background\nThe bundle size is growing too large, and separate teams need independent deployment lifecycles.\n\n## ✅ Acceptance Criteria\n- [ ] Migrate Vite to Webpack 5 (or configure Vite Module Federation plugin).\n- [ ] Split `Events` into a remote module and consume it in the Host shell.\n- [ ] Ensure shared dependencies (React, React Router) are deduplicated at runtime.\n\n## 🗂️ Files to Modify\n- `vite.config.ts` -> `webpack.config.js`\n- `src/App.tsx` (Dynamic remote imports)",
    labels: ["ECSoC26", "good-issue"]
  },
  {
    title: "Implement a distributed rate-limiting algorithm using Redis and Lua scripting",
    body: "## 📋 Summary\nProtect the API endpoints with a Sliding Window Log rate limit. Write a custom Lua script executed atomically on an Upstash Redis instance to manage request counts.\n\n## 🎯 Background\nStandard leaky bucket algorithms can allow bursts. Sliding window log provides mathematically exact rate limits for DDOS protection.\n\n## ✅ Acceptance Criteria\n- [ ] Write a Lua script that manages ZSETs (sorted sets) for timestamps.\n- [ ] Integrate into a Supabase Edge Function middleware.\n- [ ] Return standard `429 Too Many Requests` with `Retry-After` headers.\n\n## 🗂️ Files to Modify\n- `supabase/functions/shared/rate-limiter.lua`\n- `supabase/functions/shared/middleware.ts`",
    labels: ["ECSoC26", "good-backend"]
  },
  {
    title: "Build a generic GraphQL API wrapper over Supabase REST endpoints",
    body: "## 📋 Summary\nSet up a GraphQL server (Apollo/Yoga) that introspects the Supabase OpenAPI spec and automatically generates a GraphQL schema, allowing front-end devs to use GraphQL queries.\n\n## 🎯 Background\nSome developers prefer GraphQL for its precise data-fetching over the PostgREST syntax.\n\n## ✅ Acceptance Criteria\n- [ ] Create a Node/Edge environment hosting GraphQL Yoga.\n- [ ] Implement dynamic schema generation or manual resolvers mapping to Supabase JS client.\n- [ ] Support nested relational queries and properly handle the N+1 problem using DataLoader.\n\n## 🗂️ Files to Modify\n- `graphql/server.ts`\n- `graphql/resolvers/index.ts`",
    labels: ["ECSoC26", "good-issue"]
  },
  {
    title: "Design a robust RBAC system with hierarchical inheritance using recursive CTEs",
    body: "## 📋 Summary\nImplement Role-Based Access Control where permissions are inherited (e.g., 'Super Admin' inherits 'Club Admin' inherits 'Member'). Use Postgres Recursive Common Table Expressions (CTEs) to resolve permissions at runtime within RLS.\n\n## 🎯 Background\nHardcoding roles in RLS policies leads to duplication and errors. A dynamic RBAC tree is highly scalable.\n\n## ✅ Acceptance Criteria\n- [ ] Create `roles`, `permissions`, and `role_permissions` tables.\n- [ ] Write a recursive CTE view `user_effective_permissions`.\n- [ ] Update Row Level Security to check against this view securely without performance degradation.\n\n## 🗂️ Files to Modify\n- `supabase/migrations/xxxx_rbac_schema.sql`",
    labels: ["ECSoC26", "good-backend"]
  },
  {
    title: "Implement a Service Worker for full offline support and background sync",
    body: "## 📋 Summary\nTransform the site into a true Progressive Web App (PWA). Use Workbox to cache the application shell and IndexedDB to queue database mutations (like posting a comment) when the device goes offline.\n\n## 🎯 Background\nStudents often lose WiFi in lecture halls. The app should remain fully functional offline and sync automatically upon reconnection.\n\n## ✅ Acceptance Criteria\n- [ ] Register a custom Service Worker.\n- [ ] Intercept Supabase API calls; if offline, store the payload in IndexedDB.\n- [ ] Use the Background Sync API to dispatch the queued requests when online.\n\n## 🗂️ Files to Modify\n- `src/sw.ts`\n- `src/lib/offlineSync.ts`",
    labels: ["ECSoC26", "good-ui"]
  },
  {
    title: "Create a multi-region Active-Active failover strategy for the database layer",
    body: "## 📋 Summary\nDesign a deployment strategy involving logical replication between two PostgreSQL instances in different geographic regions, with a connection pooler routing read/writes.\n\n## 🎯 Background\nIf the primary AWS/GCP region goes down, the application goes down. We need high availability (HA).\n\n## ✅ Acceptance Criteria\n- [ ] Set up logical replication publications/subscriptions.\n- [ ] Deploy pgBouncer or Supavisor to handle connection routing.\n- [ ] Document the failover procedure and conflict resolution strategy for split-brain scenarios.\n\n## 🗂️ Files to Modify\n- `docs/ARCHITECTURE.md`\n- Infrastructure scripts (Terraform/Pulumi)",
    labels: ["ECSoC26", "good-issue"]
  },
  {
    title: "Build an AI-powered content moderation pipeline using Vector Embeddings",
    body: "## 📋 Summary\nAutomatically flag toxic posts by converting user text into OpenAI embeddings and comparing the cosine similarity against a database of known toxic patterns using pgvector.\n\n## 🎯 Background\nKeyword blocklists are easily bypassed. Semantic similarity provides a robust, context-aware moderation filter.\n\n## ✅ Acceptance Criteria\n- [ ] Enable `pgvector` in Supabase.\n- [ ] Create a Database Webhook triggering an Edge Function on new posts.\n- [ ] Call the OpenAI Embeddings API, generate a vector, and query the DB for semantic matches > 0.85 similarity.\n\n## 🗂️ Files to Modify\n- `supabase/functions/ai-moderation/index.ts`\n- `supabase/migrations/xxxx_pgvector.sql`",
    labels: ["ECSoC26", "good-backend"]
  },
  {
    title: "Design a bidirectional WebSocket event bus for cross-tab synchronization",
    body: "## 📋 Summary\nUse the BroadcastChannel API alongside WebSockets to ensure that if a user logs out in Tab A, Tab B instantly terminates the session and redirects to login, managing token refreshes centrally.\n\n## 🎯 Background\nMultiple tabs can have desynced JWT tokens, causing random API 401 errors. A centralized event bus solves this.\n\n## ✅ Acceptance Criteria\n- [ ] Implement a Singleton `SessionManager` class.\n- [ ] Elect a 'Leader' tab using Web Locks API to handle token refresh network requests.\n- [ ] Broadcast token updates to all follower tabs instantly.\n\n## 🗂️ Files to Modify\n- `src/lib/SessionManager.ts`\n- `src/hooks/useAuthStatus.ts`",
    labels: ["ECSoC26", "good-ui"]
  },
  {
    title: "Implement a custom virtualized list component capable of rendering 100,000+ items",
    body: "## 📋 Summary\nDo not use a library. Build a React component from scratch that calculates the visible scroll window and absolutely positions only the DOM nodes currently in the viewport, recycling nodes as the user scrolls.\n\n## 🎯 Background\nDisplaying the global university user directory crashes the DOM. A custom virtualizer optimized for our specific row heights is required for maximum FPS.\n\n## ✅ Acceptance Criteria\n- [ ] Calculate `scrollTop`, `viewportHeight`, and row boundaries.\n- [ ] Maintain a constant number of DOM elements (e.g., 20) regardless of the dataset size.\n- [ ] Handle dynamic row heights accurately.\n\n## 🗂️ Files to Modify\n- `src/components/ui/VirtualList.tsx`\n- `src/pages/Directory.tsx`",
    labels: ["ECSoC26", "good-ui"]
  },
  {
    title: "Develop a fine-grained reactivity system from scratch to replace React Context",
    body: "## 📋 Summary\nReact Context causes entire subtrees to re-render. Build a custom Signals/Observables implementation (similar to SolidJS or Preact Signals) using Proxy objects to update only the specific DOM text nodes that change.\n\n## 🎯 Background\nWe are facing massive re-render bottlenecks on the dashboard when a single global state variable changes.\n\n## ✅ Acceptance Criteria\n- [ ] Implement a `createSignal` and `createEffect` function.\n- [ ] Use JavaScript Proxies to track dependency graphs.\n- [ ] Bypass React's render cycle for signal updates to directly mutate the DOM.\n\n## 🗂️ Files to Modify\n- `src/lib/signals.ts`\n- `src/store/globalState.ts`",
    labels: ["ECSoC26", "good-pr"]
  },
  {
    title: "Build a custom WebGL renderer for visualizing massive graphs of user connections",
    body: "## 📋 Summary\nCreate a 3D visualization canvas using raw WebGL (or Three.js) to map out how students are connected across different clubs, using a force-directed graph algorithm.\n\n## 🎯 Background\nCanvas/SVG API is too slow for drawing 10,000+ nodes and edges. GPU acceleration via WebGL is required.\n\n## ✅ Acceptance Criteria\n- [ ] Write custom Vertex and Fragment shaders for rendering nodes (circles) and edges (lines).\n- [ ] Implement a Web Worker to calculate the physics (Barnes-Hut algorithm) off the main thread.\n- [ ] Pass the position buffer arrays to WebGL efficiently.\n\n## 🗂️ Files to Modify\n- `src/components/NetworkGraph/GraphRenderer.ts`\n- `src/components/NetworkGraph/physics.worker.ts`",
    labels: ["ECSoC26", "good-ui"]
  },
  {
    title: "Implement Zero-Knowledge Proof (ZKP) authentication for anonymous voting",
    body: "## 📋 Summary\nFor Club Elections, members must be able to prove they are authorized to vote WITHOUT revealing their identity to the database. Implement a ZK-SNARK protocol integration.\n\n## 🎯 Background\nTraditional anonymous voting in SQL is flawed because DB admins can check timestamps/logs. Cryptographic ZKPs guarantee absolute anonymity.\n\n## ✅ Acceptance Criteria\n- [ ] Use `snarkjs` to generate a proof in the browser that the user owns a valid membership token.\n- [ ] Verify the proof in a Supabase Edge Function without seeing the user's ID.\n- [ ] Record the vote against a nullifier hash to prevent double voting.\n\n## 🗂️ Files to Modify\n- `src/lib/zkp.ts`\n- `supabase/functions/verify-vote/index.ts`",
    labels: ["ECSoC26", "good-backend"]
  },
  {
    title: "Design a robust Event Sourcing architecture for audit logging",
    body: "## 📋 Summary\nInstead of just updating rows, design a system where every state change (Create, Update, Delete) is appended as an immutable event to an `event_store` table, allowing the system state to be reconstructed at any point in time.\n\n## 🎯 Background\nFor administrative accountability, we must have an irrefutable audit trail of who changed what and when, exactly like a banking ledger.\n\n## ✅ Acceptance Criteria\n- [ ] Create `event_store` table (aggregate_id, event_type, payload, timestamp).\n- [ ] Write Postgres Triggers to intercept DML operations on critical tables and append events.\n- [ ] Create a materialized view that projects the current state from the event stream.\n\n## 🗂️ Files to Modify\n- `supabase/migrations/xxxx_event_sourcing.sql`",
    labels: ["ECSoC26", "good-backend"]
  },
  {
    title: "Create a highly optimized, custom SQL parser and query builder",
    body: "## 📋 Summary\nBuild a TypeScript utility that takes complex, nested JSON filter objects from the frontend UI and securely compiles them into raw, highly optimized parameterized Postgres SQL queries, bypassing PostgREST for analytical dashboards.\n\n## 🎯 Background\nThe native Supabase JS client struggles with deep, dynamic `OR` / `AND` combinations required by the new analytics dashboard.\n\n## ✅ Acceptance Criteria\n- [ ] Write a recursive function traversing the JSON filter tree.\n- [ ] Protect against SQL injection by strictly enforcing parameterized inputs `$1, $2`.\n- [ ] Execute the generated query via a secure Postgres Function with `security definer`.\n\n## 🗂️ Files to Modify\n- `src/lib/queryBuilder.ts`\n- `supabase/migrations/xxxx_execute_raw.sql`",
    labels: ["ECSoC26", "good-pr"]
  },
  {
    title: "Implement end-to-end encryption (E2EE) for direct messages",
    body: "## 📋 Summary\nIntegrate the Signal Protocol or WebCrypto API to ensure that private messages between students are encrypted on the client side before reaching Supabase. The database should only store ciphertext.\n\n## 🎯 Background\nPrivacy is paramount. Even database administrators should not be able to read private DM contents.\n\n## ✅ Acceptance Criteria\n- [ ] Generate ECDH Keypairs securely in the browser using WebCrypto.\n- [ ] Exchange public keys between users via the database.\n- [ ] Encrypt payload with AES-GCM before sending, decrypt on receipt.\n\n## 🗂️ Files to Modify\n- `src/lib/crypto.ts`\n- `src/components/Messages/ChatBox.tsx`",
    labels: ["ECSoC26", "good-backend"]
  },
  {
    title: "Build a distributed tracing system using OpenTelemetry",
    body: "## 📋 Summary\nInstrument the frontend React app, Edge Functions, and database queries with OpenTelemetry spans. Propagate trace contexts across the network boundary to visualize the exact lifecycle of a request.\n\n## 🎯 Background\nWhen an action is slow, we have no idea if the bottleneck is React rendering, network latency, the Deno runtime, or the Postgres query planner.\n\n## ✅ Acceptance Criteria\n- [ ] Setup `@opentelemetry/api` on the client to start a trace.\n- [ ] Inject `traceparent` headers into Supabase fetch calls.\n- [ ] Extract the context in the Edge Function and append spans, exporting to a collector (e.g., Jaeger or Honeycomb).\n\n## 🗂️ Files to Modify\n- `src/instrumentation.ts`\n- `supabase/functions/shared/telemetry.ts`",
    labels: ["ECSoC26", "good-issue"]
  }
];

async function createHardIssues() {
  console.log("\n🚀 CampusConnect — 20 HARD Issues Script");
  console.log(`📦 Repository: ${GITHUB_REPO}`);
  console.log(`📝 Total issues to create: ${hardIssues.length}\n`);

  let createdCount = 0;
  const createdNumbers: number[] = [];

  for (let index = 0; index < hardIssues.length; index++) {
    const issue = hardIssues[index];
    const issueNum = String(index + 1).padStart(2, "0");

    console.log(`➕ [${issueNum}/${hardIssues.length}] CREATE — "${issue.title.slice(0, 70)}..."`);

    const res = await githubRequest("/issues", "POST", issue);
    if (res) {
      createdCount++;
      createdNumbers.push(res.number);
      console.log(`   ✅ Created: #${res.number} — ${res.html_url} with labels: ${issue.labels.join(', ')}`);
    } else {
      console.log("   ❌ Failed to create this issue.");
    }

    if (index < hardIssues.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log("🎉 Issue Creation Done!");
  console.log(`   ✅ Created : ${createdCount} issues`);
  console.log(`${"─".repeat(60)}\n`);

  if (createdNumbers.length > 0) {
    console.log("⏳ Waiting 45 seconds for GitHub Actions to trigger and auto-assign...");
    console.log("   (After the wait, we will automatically run the unassign cleanup loop)");
    await new Promise((resolve) => setTimeout(resolve, 45000));

    console.log("\n🧹 Starting unassign cleanup loop...");
    for (const num of createdNumbers) {
      console.log(`🗑️  Unassigning from issue #${num}...`);
      const issue = await githubRequest(`/issues/${num}`);
      if (issue) {
        const assignees: string[] = (issue.assignees || []).map((a: { login: string }) => a.login);
        if (assignees.length > 0) {
          await githubRequest(`/issues/${num}/assignees`, "DELETE", { assignees });
          console.log("   ✅ Successfully unassigned.");
        } else {
          console.log("   ✅ Already unassigned.");
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    console.log("\n🎉 All unassignment cleanups completed successfully!");
  }
}

createHardIssues();
