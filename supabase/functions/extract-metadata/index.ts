import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    try {
      const url = new URL(req.url);
      const targetUrl = url.searchParams.get("url");

      if (!targetUrl) {
        return Response.json({ error: "URL parameter is required" }, { status: 400 });
      }

      const response = await fetch(targetUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const title = $('meta[property="og:title"]').attr("content") || $("title").text() || "";
      const description =
        $('meta[property="og:description"]').attr("content") ||
        $('meta[name="description"]').attr("content") ||
        "";
      const image = $('meta[property="og:image"]').attr("content") || "";

      return Response.json({ title, description, image, url: targetUrl });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  }),
};
