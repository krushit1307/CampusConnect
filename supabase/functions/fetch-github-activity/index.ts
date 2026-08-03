import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.24.2";
import { redis } from "../_shared/redis.ts";
import { parseJsonBody } from "../_shared/validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const requestSchema = z
  .object({
    club_id: z.string().uuid().optional(),
    github_repo_url: z.string().url().optional(),
  })
  .refine((data) => data.club_id || data.github_repo_url, {
    message: "Either club_id or github_repo_url must be provided",
  });

function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com") return null;
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    let repo = parts[1];
    if (repo.endsWith(".git")) repo = repo.slice(0, -4);
    return { owner: parts[0], repo };
  } catch {
    return null;
  }
}

async function fetchGitHubAPI(endpoint: string, token: string | undefined) {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "CampusConnect-EdgeFunction",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`https://api.github.com${endpoint}`, { headers });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const rawText = await req.text();
    const parsed = await parseJsonBody(
      requestSchema,
      new Request(req.url, {
        method: "POST",
        headers: req.headers,
        body: rawText.trim() ? rawText : null,
      }),
    );

    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    let githubUrl = body.github_repo_url;

    if (!githubUrl && body.club_id) {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );

      const { data: club, error } = await supabaseAdmin
        .from("clubs")
        .select("github_repo_url")
        .eq("id", body.club_id)
        .single();

      if (error || !club) {
        return new Response(
          JSON.stringify({ error: "Club not found or error fetching club details" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      if (!club.github_repo_url) {
        return new Response(
          JSON.stringify({ error: "Club does not have a linked GitHub repository" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      githubUrl = club.github_repo_url;
    }

    if (!githubUrl) {
      return new Response(JSON.stringify({ error: "Missing github_repo_url" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const repoDetails = parseGithubUrl(githubUrl);
    if (!repoDetails) {
      return new Response(JSON.stringify({ error: "Invalid GitHub repository URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { owner, repo } = repoDetails;
    const cacheKey = `github_activity:${owner}:${repo}`;

    // 1. Check Redis Cache
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return new Response(JSON.stringify(cached), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (redisError) {
        console.warn("[fetch-github-activity] Redis cache read failed:", redisError);
      }
    }

    // 2. Fetch from GitHub API
    const githubToken = Deno.env.get("GITHUB_TOKEN");

    try {
      const [repoData, commitsData, pullsData] = await Promise.all([
        fetchGitHubAPI(`/repos/${owner}/${repo}`, githubToken),
        fetchGitHubAPI(`/repos/${owner}/${repo}/commits?per_page=5`, githubToken),
        fetchGitHubAPI(
          `/repos/${owner}/${repo}/pulls?state=all&per_page=5&sort=updated&direction=desc`,
          githubToken,
        ),
      ]);

      const normalizedActivity = {
        repository: {
          name: repoData.name,
          full_name: repoData.full_name,
          description: repoData.description,
          stargazers_count: repoData.stargazers_count,
          forks_count: repoData.forks_count,
          language: repoData.language,
          updated_at: repoData.updated_at,
          html_url: repoData.html_url,
        },
        commits: commitsData.map((c: any) => ({
          sha: c.sha,
          message: c.commit.message,
          author_name: c.commit.author.name,
          author_avatar: c.author?.avatar_url || null,
          date: c.commit.author.date,
          html_url: c.html_url,
        })),
        pullRequests: pullsData.map((pr: any) => ({
          id: pr.id,
          number: pr.number,
          title: pr.title,
          state: pr.state,
          user_login: pr.user.login,
          user_avatar: pr.user.avatar_url,
          created_at: pr.created_at,
          updated_at: pr.updated_at,
          html_url: pr.html_url,
        })),
        fetched_at: new Date().toISOString(),
      };

      // 3. Cache the result for 6 hours (21600 seconds)
      if (redis) {
        try {
          await redis.set(cacheKey, normalizedActivity, { ex: 21600 });
        } catch (redisError) {
          console.warn("[fetch-github-activity] Redis cache write failed:", redisError);
        }
      }

      return new Response(JSON.stringify(normalizedActivity), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (githubError: any) {
      console.error("[fetch-github-activity] GitHub API error:", githubError);

      const isRateLimit =
        githubError.message?.includes("403") || githubError.message?.includes("429");
      const isNotFound = githubError.message?.includes("404");

      if (isRateLimit) {
        return new Response(JSON.stringify({ error: "GitHub API rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (isNotFound) {
        return new Response(JSON.stringify({ error: "GitHub repository not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Failed to fetch GitHub activity" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("[fetch-github-activity] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
