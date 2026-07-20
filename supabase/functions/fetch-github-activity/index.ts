import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours

// In-memory cache as a fast L1 cache
const memoryCache = new Map<string, { data: any; timestamp: number }>();

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { github_repo_url } = await req.json();

    if (!github_repo_url) {
      return new Response(JSON.stringify({ error: "Missing github_repo_url" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const match = github_repo_url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      return new Response(JSON.stringify({ error: "Invalid GitHub repository URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const owner = match[1];
    let repo = match[2];
    if (repo.endsWith(".git")) {
      repo = repo.slice(0, -4);
    }

    const cacheKey = `${owner}/${repo}`;
    const now = Date.now();

    // 1. Check in-memory cache
    const memCached = memoryCache.get(cacheKey);
    if (memCached && now - memCached.timestamp < CACHE_DURATION_MS) {
      return new Response(JSON.stringify(memCached.data), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Try fetching from Deno KV (Key-Value DB) if available
    let kv: Deno.Kv | undefined;
    try {
      kv = await Deno.openKv();
      const kvCached = await kv.get(["github_activity", owner, repo]);
      if (kvCached.value) {
        const { data, timestamp } = kvCached.value as { data: any; timestamp: number };
        if (now - timestamp < CACHE_DURATION_MS) {
          // Restore to memory cache
          memoryCache.set(cacheKey, { data, timestamp });
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    } catch (e) {
      console.warn("Deno KV is not available. Continuing with memory cache only.");
    }

    // 3. Fetch from GitHub API
    const headers: HeadersInit = {
      "User-Agent": "CampusConnect-Edge-Function",
      Accept: "application/vnd.github.v3+json",
    };

    const githubToken = Deno.env.get("GITHUB_TOKEN");
    if (githubToken) {
      headers["Authorization"] = `Bearer ${githubToken}`;
    }

    const [commitsRes, prsRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=5`, { headers }),
      fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=5`, {
        headers,
      }),
    ]);

    if (commitsRes.status === 403 || prsRes.status === 403) {
      return new Response(JSON.stringify({ error: "GitHub API rate limit exceeded." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let commits = [];
    if (commitsRes.ok) commits = await commitsRes.json();

    let prs = [];
    if (prsRes.ok) prs = await prsRes.json();

    const activityData = {
      commits: commits.map((c: any) => ({
        sha: c.sha,
        message: c.commit.message,
        author: c.commit.author?.name || c.commit.committer?.name || "Unknown",
        date: c.commit.author?.date,
        url: c.html_url,
      })),
      pull_requests: prs.map((pr: any) => ({
        id: pr.id,
        title: pr.title,
        state: pr.state,
        user: pr.user?.login || "Unknown",
        created_at: pr.created_at,
        url: pr.html_url,
      })),
    };

    // Update in-memory cache
    memoryCache.set(cacheKey, { data: activityData, timestamp: now });

    // Update Deno KV cache
    if (kv) {
      try {
        await kv.set(["github_activity", owner, repo], { data: activityData, timestamp: now });
      } catch (e) {
        console.warn("Failed to set Deno KV cache", e);
      }
    }

    return new Response(JSON.stringify(activityData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching GitHub activity:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred fetching GitHub activity." }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
