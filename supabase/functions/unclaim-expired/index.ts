import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXPIRATION_HOURS = 30;

function readMetadata(body: string | null) {
  if (!body) return {};
  const match = body.match(/<!-- cc:metadata:start -->([\s\S]*?)<!-- cc:metadata:end -->/);
  if (!match) return {};
  try {
    return JSON.parse(match[1]);
  } catch (e) {
    return {};
  }
}

function clearAssignmentMetadata(metadata: any) {
  const newMeta = { ...metadata };
  delete newMeta.assignedAt;
  delete newMeta.lastActivityAt;
  delete newMeta.reminder12SentAt;
  delete newMeta.reminder18SentAt;
  delete newMeta.expiredAt;
  return newMeta;
}

function updateIssueBody(body: string, newMetadata: any) {
  const metaString = `<!-- cc:metadata:start -->\n${JSON.stringify(newMetadata, null, 2)}\n<!-- cc:metadata:end -->`;
  if (body.match(/<!-- cc:metadata:start -->[\s\S]*?<!-- cc:metadata:end -->/)) {
    return body.replace(/<!-- cc:metadata:start -->[\s\S]*?<!-- cc:metadata:end -->/, metaString);
  }
  return `${body}\n\n${metaString}`;
}

function hoursSince(isoString: string) {
  if (!isoString) return 0;
  const time = new Date(isoString).getTime();
  if (isNaN(time)) return 0;
  return (Date.now() - time) / (1000 * 60 * 60);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  if (!webhookSecret || authHeader !== `Bearer ${webhookSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const githubToken = Deno.env.get("GITHUB_TOKEN");
    if (!githubToken) {
      throw new Error("Missing GITHUB_TOKEN environment variable.");
    }

    let owner = "krushit1307";
    let repo = "CampusConnect";

    try {
      const bodyText = await req.text();
      if (bodyText) {
        const body = JSON.parse(bodyText);
        if (body.owner) owner = body.owner;
        if (body.repo) repo = body.repo;
      }
    } catch (e) {
      const envRepo = Deno.env.get("GITHUB_REPOSITORY");
      if (envRepo) {
        const parts = envRepo.split("/");
        if (parts.length === 2) {
          owner = parts[0];
          repo = parts[1];
        }
      }
    }

    const headers: HeadersInit = {
      "User-Agent": "CampusConnect-Edge-Function",
      Accept: "application/vnd.github.v3+json",
      Authorization: `Bearer ${githubToken}`,
    };

    const issuesRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues?state=open&assignee=*&per_page=100`,
      { headers },
    );

    if (!issuesRes.ok) {
      throw new Error(`Failed to fetch issues: ${await issuesRes.text()}`);
    }

    const issues = await issuesRes.json();
    let processed = 0;
    let unclaimed = 0;

    for (const issue of issues) {
      if (issue.pull_request) continue;

      const assignee = issue.assignees?.[0]?.login;
      if (!assignee) continue;

      const metadata = readMetadata(issue.body);
      const baseline = metadata.lastActivityAt || metadata.assignedAt || issue.updated_at;
      const inactiveHours = hoursSince(baseline);

      if (inactiveHours >= EXPIRATION_HOURS) {
        processed++;

        const prsRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=100`,
          { headers },
        );

        let hasLinkedPr = false;
        if (prsRes.ok) {
          const prs = await prsRes.json();
          hasLinkedPr = prs.some((pr: any) => {
            if (pr.user?.login !== assignee) return false;
            const issueRefRegex = new RegExp(`#${issue.number}\\b`);
            return issueRefRegex.test(pr.body || "");
          });
        }

        if (hasLinkedPr) {
          continue;
        }

        await fetch(
          `https://api.github.com/repos/${owner}/${repo}/issues/${issue.number}/assignees`,
          {
            method: "DELETE",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ assignees: [assignee] }),
          },
        );

        await fetch(
          `https://api.github.com/repos/${owner}/${repo}/issues/${issue.number}/comments`,
          {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({
              body: "This issue has been auto-unclaimed due to inactivity.",
            }),
          },
        );

        const updatedMetadata = clearAssignmentMetadata(metadata);
        const newBody = updateIssueBody(issue.body || "", updatedMetadata);

        await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issue.number}`, {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ body: newBody }),
        });

        unclaimed++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processed} inactive claims, unclaimed ${unclaimed}.`,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Internal Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An unexpected error occurred.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
