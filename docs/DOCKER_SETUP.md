# 🐳 Running with Docker

Alternatively, you can run the project containerized using Docker. This allows you to build and run the application without needing Node/npm installed locally on your host machine.

## Local Development (with Hot-Reloading / HMR)

1. **Set up environment variables:**

   ```bash
   cp .env.example .env.local
   ```

   Fill in your Supabase URL and Anon Key in `.env.local`.

2. **Start the development container:**
   ```bash
   docker compose up --build
   ```
   This will build the dev image and launch the Vite dev server inside the container. The application will be accessible at `http://localhost:8080` with volume-mounted hot-reloading (HMR) fully functional.

## Production Build & Run

1. **Build the production Docker image:**

   ```bash
   docker build --target runner -t campusconnect:latest .
   ```

2. **Run the production container:**
   ```bash
   docker run -d -p 3000:3000 --env-file .env.local --name campusconnect campusconnect:latest
   ```
   The production-built SPA will be served via the static file server (`serve -s dist -l 3000`) on `http://localhost:3000`.
   