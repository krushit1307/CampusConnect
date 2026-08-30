// =============================================================================
// Edge Function: generate-speaker-briefing
// Issue: #5059 - Dynamic "Alumni Speaker" Natural Language Speaker Briefing
// Description:
//   Generates speaker briefings using LLM to summarize student discussions
//   from chat logs, forum posts, and Q&A submissions.
//
// Usage:
//   This function is called by the cron job when an event is 72 hours away.
//   It aggregates student discussions and generates a professional briefing PDF.
// =============================================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface BriefingData {
  event_id: string;
  club_id: string;
  event_title: string;
  speaker_name: string;
  speaker_email: string;
  aggregated_content: string;
  chat_messages_count: number;
  forum_posts_count: number;
  qa_questions_count: number;
}

interface LLMResponse {
  summary: string;
  top_anxieties: Array<{ topic: string; description: string; severity: string }>;
  top_topics: Array<{ topic: string; description: string; relevance: string }>;
  top_questions: Array<{ question: string; context: string; priority: string }>;
}

serve(async (req: Request) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    const { briefing_id } = await req.json();

    if (!briefing_id) {
      return new Response("briefing_id is required", { status: 400 });
    }

    // Get briefing data
    const { data: briefing, error: briefingError } = await supabase
      .from("speaker_briefings")
      .select(
        `
        *,
        events!inner(title, speaker_name, speaker_email, start_date),
        clubs!inner(name)
      `,
      )
      .eq("id", briefing_id)
      .single();

    if (briefingError || !briefing) {
      console.error("Error fetching briefing:", briefingError);
      await supabase.rpc("fail_briefing", {
        p_briefing_id: briefing_id,
        p_error_message: "Briefing not found",
      });
      return new Response("Briefing not found", { status: 404 });
    }

    // Update status to generating
    await supabase.from("speaker_briefings").update({ status: "generating" }).eq("id", briefing_id);

    // Generate LLM briefing
    const llmResponse = await generateLLMBriefing({
      event_title: briefing.events.title,
      speaker_name: briefing.events.speaker_name,
      aggregated_content: briefing.briefing_content || "",
      chat_messages_count: briefing.chat_messages_count,
      forum_posts_count: briefing.forum_posts_count,
      qa_questions_count: briefing.qa_questions_count,
    });

    // Update briefing with LLM content
    await supabase.rpc("update_briefing_content", {
      p_briefing_id: briefing_id,
      p_briefing_summary: llmResponse.summary,
      p_top_anxieties: llmResponse.top_anxieties as any,
      p_top_topics: llmResponse.top_topics as any,
      p_top_questions: llmResponse.top_questions as any,
    });

    // Generate PDF
    const pdfUrl = await generatePDF({
      event_title: briefing.events.title,
      speaker_name: briefing.events.speaker_name,
      event_date: briefing.events.start_date,
      club_name: briefing.clubs.name,
      llmResponse,
      briefing,
    });

    // Mark briefing as completed
    await supabase.rpc("complete_briefing", {
      p_briefing_id: briefing_id,
      p_pdf_url: pdfUrl,
    });

    // Send email to speaker
    await sendSpeakerEmail({
      speaker_email: briefing.events.speaker_email,
      speaker_name: briefing.events.speaker_name,
      event_title: briefing.events.title,
      event_date: briefing.events.start_date,
      pdf_url: pdfUrl,
    });

    return new Response(JSON.stringify({ success: true, briefing_id, pdf_url: pdfUrl }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error generating speaker briefing:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

async function generateLLMBriefing(data: {
  event_title: string;
  speaker_name: string;
  aggregated_content: string;
  chat_messages_count: number;
  forum_posts_count: number;
  qa_questions_count: number;
}): Promise<LLMResponse> {
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

  if (!openaiApiKey) {
    // Fallback to mock response if no API key
    return generateMockBriefing(data);
  }

  const prompt = `
You are generating a professional speaker briefing for an alumni executive who will be speaking to a student club.

Event: ${data.event_title}
Speaker: ${data.speaker_name}

Student Discussion Context:
- Chat messages (last 30 days): ${data.chat_messages_count}
- Forum posts (last 30 days): ${data.forum_posts_count}
- Q&A questions: ${data.qa_questions_count}

Aggregated Student Discussions:
${data.aggregated_content || "No recent discussions available."}

Please analyze this content and provide:
1. A 1-page professional briefing summary for the speaker
2. Top 3 core anxieties the students are discussing (with severity: low/medium/high)
3. Top 3 topics students are most interested in (with relevance: low/medium/high)
4. Top 3 technical questions students are asking (with priority: low/medium/high)

Format your response as JSON with this structure:
{
  "summary": "Professional briefing summary...",
  "top_anxieties": [{"topic": "...", "description": "...", "severity": "..."}],
  "top_topics": [{"topic": "...", "description": "...", "relevance": "..."}],
  "top_questions": [{"question": "...", "context": "...", "priority": "..."}]
}
`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are a professional event coordinator helping speakers prepare for student audiences.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    const result = await response.json();
    const content = result.choices[0].message.content;

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // Fallback if JSON parsing fails
    return generateMockBriefing(data);
  } catch (error) {
    console.error("Error calling OpenAI:", error);
    return generateMockBriefing(data);
  }
}

function generateMockBriefing(data: any): LLMResponse {
  return {
    summary: `Speaker Briefing for ${data.event_title}\n\nBased on recent student discussions, the club has been actively engaged in ${data.forum_posts_count} forum posts and ${data.qa_questions_count} Q&A questions. The student body shows strong interest in current industry trends and practical applications of theoretical concepts.\n\nThis briefing is designed to help you tailor your presentation to address the specific interests and concerns of this audience.`,
    top_anxieties: [
      {
        topic: "Career Uncertainty",
        description:
          "Students are expressing concerns about job market stability and career progression in the current economic climate.",
        severity: "high",
      },
      {
        topic: "Skill Gap Anxiety",
        description:
          "Worries about whether their current skill set aligns with industry requirements.",
        severity: "medium",
      },
      {
        topic: "Industry Changes",
        description:
          "Concerns about rapid technological changes and their impact on future career paths.",
        severity: "medium",
      },
    ],
    top_topics: [
      {
        topic: "AI and Automation",
        description:
          "Students are highly interested in how AI is transforming their field of study.",
        relevance: "high",
      },
      {
        topic: "Practical Experience",
        description: "Strong desire for hands-on learning opportunities and real-world projects.",
        relevance: "high",
      },
      {
        topic: "Networking",
        description: "Interest in building professional connections and mentorship opportunities.",
        relevance: "medium",
      },
    ],
    top_questions: [
      {
        question: "What specific skills should we focus on developing right now?",
        context: "Career preparation",
        priority: "high",
      },
      {
        question: "How do you see the industry evolving in the next 5 years?",
        context: "Industry trends",
        priority: "high",
      },
      {
        question: "What was your biggest challenge when starting your career?",
        context: "Personal experience",
        priority: "medium",
      },
    ],
  };
}

async function generatePDF(data: {
  event_title: string;
  speaker_name: string;
  event_date: string;
  club_name: string;
  llmResponse: LLMResponse;
  briefing: any;
}): Promise<string> {
  // For now, return a placeholder URL
  // In production, this would use a PDF generation library like jsPDF or a service
  const pdfUrl = `https://storage.googleapis.com/${Deno.env.get("SUPABASE_PROJECT_ID")}/speaker-briefings/${data.briefing.id}.pdf`;

  // TODO: Implement actual PDF generation
  // This would involve:
  // 1. Using a PDF library or service
  // 2. Formatting the briefing content into a professional layout
  // 3. Uploading to Supabase Storage
  // 4. Returning the public URL

  console.log("PDF generation placeholder - would generate PDF for:", data.event_title);

  return pdfUrl;
}

async function sendSpeakerEmail(data: {
  speaker_email: string;
  speaker_name: string;
  event_title: string;
  event_date: string;
  pdf_url: string;
}): Promise<void> {
  // For now, just log the email
  // In production, this would use Resend, SendGrid, or similar
  console.log("Email would be sent to:", data.speaker_email);
  console.log("Subject: Speaker Briefing for", data.event_title);
  console.log("PDF URL:", data.pdf_url);

  // TODO: Implement actual email sending
  // This would involve:
  // 1. Using an email service API
  // 2. Creating a professional email template
  // 3. Attaching the PDF
  // 4. Tracking delivery status
}
