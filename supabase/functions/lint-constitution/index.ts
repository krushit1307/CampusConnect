// =============================================================================
// Edge Function: Lint Constitution
// Issue: #3536 - Implement 'Club Constitution Conflict Resolver'
// Description: Triggered when a new constitution PDF is uploaded. Downloads
// the file, extracts raw text using pdfjs-dist, and passes it to GPT-4 to
// identify violations against the Student Union Master Rules.
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4.20.0";
import * as pdfjsLib from "https://esm.sh/pdfjs-dist@3.11.174/build/pdf.mjs";
import {
  CONSTITUTION_PLAGIARISM_THRESHOLD,
  findConstitutionPlagiarismMatches,
} from "../_shared/constitution-plagiarism.ts";

// Configure PDF.js worker for Deno environment
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://esm.sh/pdfjs-dist@3.11.174/build/pdf.worker.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });

const MASTER_RULES_PROMPT = `
You are a strict compliance officer for a University Student Union.
Your task is to review a club's constitution and flag any clauses that violate the "Master Rules".

Master Rules:
1. Non-Discrimination: Clubs cannot restrict membership based on race, gender, religion, sexual orientation, or disability.
2. Financial Transparency: Clubs must mandate an annual audit and open financial records to all members.
3. Democratic Elections: All executive board members must be elected by a majority vote of the active membership.
4. Hazing Prohibition: Any mention of forced activities, humiliation, or physical endurance as a requirement for membership is strictly prohibited.
5. University Branding: Clubs cannot claim to represent the University as a whole without explicit permission.

Analyze the provided text and return a JSON array of violations.
If there are no violations, return an empty array [].

JSON Format:
[
  {
    "clause_reference": "Article X, Section Y (or approximate location)",
    "quote": "Exact text from the document",
    "reason": "Explanation of which Master Rule is violated",
    "severity": "info" | "warning" | "severe"
  }
]
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { document_id, file_url } = await req.json();
    if (!document_id || !file_url) throw new Error("Missing document_id or file_url");

    // 1. Download the PDF from Supabase Storage
    const filePath = file_url.includes("/storage/v1/object/public/")
      ? file_url.split("/storage/v1/object/public/")[1]
      : String(file_url).replace(/^\/+/, "");
    if (!filePath) throw new Error("Invalid constitution storage path.");
    const storageBucket = file_url.includes("club_documents") ? "club_documents" : "club-documents";
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(storageBucket)

      .download(filePath);

    if (downloadError || !fileData) throw new Error("Failed to download PDF from storage");

    // 2. Extract text from PDF, Markdown, or plain text uploads.
    let fullText = "";
    if (/\.pdf$/iu.test(filePath)) {
      const arrayBuffer = await fileData.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ");
        fullText += pageText + "\\n\\n";
      }
    } else {
      fullText = await fileData.text();
    }
    if (!fullText.trim()) throw new Error("The constitution does not contain readable text.");

    const { data: currentDocument, error: currentDocumentError } = await supabase
      .from("constitution_documents")
      .select("club_id, clubs(name)")
      .eq("id", document_id)
      .single();
    if (currentDocumentError || !currentDocument) throw new Error("Constitution record not found.");

    // Keep raw source text for reviewers and compare against every non-rejected document.
    await supabase
      .from("constitution_documents")
      .update({ raw_text: fullText })
      .eq("id", document_id);
    const candidates: any[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data: page, error: candidatesError } = await supabase
        .from("constitution_documents")
        .select("id, raw_text, clubs(name)")
        .neq("id", document_id)
        .neq("status", "rejected")
        .not("raw_text", "is", null)
        .range(offset, offset + 999);
      if (candidatesError) throw candidatesError;
      candidates.push(...(page || []));
      if (!page || page.length < 1000) break;
    }

    const currentClub = Array.isArray(currentDocument.clubs)
      ? currentDocument.clubs[0]
      : currentDocument.clubs;
    const plagiarismMatches = findConstitutionPlagiarismMatches(
      fullText,
      candidates.map((candidate: any) => ({
        id: candidate.id,
        rawText: candidate.raw_text,
        clubName: Array.isArray(candidate.clubs) ? candidate.clubs[0]?.name : candidate.clubs?.name,
      })),
      currentClub?.name,
    );
    const plagiarismScore = plagiarismMatches[0]?.similarity || 0;
    const plagiarismReviewRequired = plagiarismScore >= CONSTITUTION_PLAGIARISM_THRESHOLD;

    await supabase
      .from("constitution_documents")
      .update({
        plagiarism_score: plagiarismScore,
        plagiarism_review_required: plagiarismReviewRequired,
        plagiarism_matches: plagiarismMatches,
        plagiarism_scanned_at: new Date().toISOString(),
      })
      .eq("id", document_id);

    // 3. Analyze with GPT-4
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: MASTER_RULES_PROMPT },
        { role: "user", content: fullText.substring(0, 12000) }, // Truncate to fit context window
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const content = completion.choices[0].message.content;
    const parsed = JSON.parse(content || "{}");
    const violations = parsed.violations || parsed || [];

    // 4. Calculate Risk Score and Insert Violations
    let severeCount = 0;
    let warningCount = 0;

    const violationsToInsert = (Array.isArray(violations) ? violations : []).map((v: any) => {
      if (v.severity === "severe") severeCount++;
      if (v.severity === "warning") warningCount++;
      return {
        document_id,
        clause_reference: v.clause_reference || "Unknown",
        quote: v.quote || "",
        reason: v.reason || "",
        severity: v.severity || "info",
      };
    });

    if (violationsToInsert.length > 0) {
      await supabase.from("constitution_violations").insert(violationsToInsert);
    }

    // Risk score: 1.0 if any severe, else weighted average of warnings
    const riskScore = severeCount > 0 ? 1.0 : Math.min(1.0, warningCount * 0.2);
    const newStatus =
      severeCount > 0 || plagiarismReviewRequired
        ? severeCount > 0
          ? "requires_revision"
          : "pending_review"
        : warningCount > 0
          ? "pending_review"
          : "approved";

    await supabase
      .from("constitution_documents")
      .update({ overall_risk_score: riskScore, status: newStatus })
      .eq("id", document_id);

    return new Response(
      JSON.stringify({
        success: true,
        violations_found: violationsToInsert.length,
        status: newStatus,
        plagiarism_score: plagiarismScore,
        plagiarism_review_required: plagiarismReviewRequired,
        plagiarism_matches: plagiarismMatches,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("[LintConstitution] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
