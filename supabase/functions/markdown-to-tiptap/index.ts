/**
 * Supabase Edge Function: Markdown to Tiptap JSON Parser
 *
 * Accepts a multipart/form-data file upload containing raw Markdown,
 * converts it to HTML, and then maps the HTML AST to the Tiptap ProseMirror JSON format.
 *
 * Deployment: npx supabase functions deploy markdown-to-tiptap
 */

// @ts-ignore: Deno imports are not recognized by the default TS LSP
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
// @ts-ignore: npm imports are specific to Deno
import { marked } from "npm:marked@4.3.0";
// @ts-ignore: npm imports are specific to Deno
import { JSDOM } from "npm:jsdom@22.1.0";

// Configure marked to be secure and predictable
marked.setOptions({
  gfm: true,
  breaks: true,
});

serve(async (req: Request) => {
  // CORS headers for frontend access
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Ensure the request is multipart/form-data
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return new Response(JSON.stringify({ error: "Content-Type must be multipart/form-data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse the form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided in form data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate file type
    if (!file.name.endsWith(".md") && file.type !== "text/markdown") {
      return new Response(JSON.stringify({ error: "File must be a Markdown (.md) file" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read file content
    const markdownText = await file.text();

    // Step 1: Convert Markdown to HTML
    const htmlContent = marked.parse(markdownText) as string;

    // Step 2: Convert HTML to Tiptap ProseMirror JSON
    const tiptapJson = htmlToTiptapJson(htmlContent);

    return new Response(
      JSON.stringify({
        success: true,
        data: tiptapJson,
        fileName: file.name,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error processing markdown:", error);
    return new Response(JSON.stringify({ error: "Internal server error during parsing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Custom HTML to Tiptap ProseMirror JSON mapper.
 * This avoids heavy dependencies by mapping common HTML tags to Tiptap nodes.
 */
function htmlToTiptapJson(html: string): any {
  const dom = new JSDOM(`<body>${html}</body>`);
  const body = dom.window.document.body;

  const content: any[] = [];

  for (const node of body.childNodes) {
    const tiptapNode = mapHtmlNodeToTiptap(node);
    if (tiptapNode) {
      content.push(tiptapNode);
    }
  }

  return {
    type: "doc",
    content: content.length > 0 ? content : [{ type: "paragraph" }],
  };
}

/**
 * Maps a single DOM node to its corresponding Tiptap node structure.
 */
function mapHtmlNodeToTiptap(node: any): any {
  if (node.nodeType === 3) {
    // Text node
    const text = node.textContent.trim();
    return text ? { type: "text", text: text } : null;
  }

  if (node.nodeType === 1) {
    // Element node
    const tagName = node.tagName.toLowerCase();
    const children = Array.from(node.childNodes).map(mapHtmlNodeToTiptap).filter(Boolean);

    // Flatten nested text nodes for simplicity in this implementation
    const flatText = children
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join(" ");

    switch (tagName) {
      case "h1":
        return {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: node.textContent.trim() }],
        };
      case "h2":
        return {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: node.textContent.trim() }],
        };
      case "h3":
        return {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: node.textContent.trim() }],
        };
      case "p":
        return { type: "paragraph", content: [{ type: "text", text: node.textContent.trim() }] };
      case "ul":
        return {
          type: "bulletList",
          content: Array.from(node.children).map((li: any) => ({
            type: "listItem",
            content: [
              { type: "paragraph", content: [{ type: "text", text: li.textContent.trim() }] },
            ],
          })),
        };
      case "ol":
        return {
          type: "orderedList",
          content: Array.from(node.children).map((li: any) => ({
            type: "listItem",
            content: [
              { type: "paragraph", content: [{ type: "text", text: li.textContent.trim() }] },
            ],
          })),
        };
      case "blockquote":
        return {
          type: "blockquote",
          content: [
            { type: "paragraph", content: [{ type: "text", text: node.textContent.trim() }] },
          ],
        };
      case "code":
        // Check if it's a block code or inline
        if (node.parentElement?.tagName.toLowerCase() === "pre") {
          return { type: "codeBlock", content: [{ type: "text", text: node.textContent }] };
        }
        return { type: "text", marks: [{ type: "code" }], text: node.textContent };
      default:
        // Fallback for unknown tags: treat as paragraph
        return { type: "paragraph", content: [{ type: "text", text: node.textContent.trim() }] };
    }
  }

  return null;
}
