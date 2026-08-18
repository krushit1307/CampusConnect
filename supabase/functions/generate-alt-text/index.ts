import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const openAiApiKey = Deno.env.get("OPENAI_API_KEY")
const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

serve(async (req) => {
  try {
    const payload = await req.json()
    
    // Supabase Storage webhook payload structure
    const record = payload.record
    if (!record || !record.name) {
      return new Response("Invalid payload", { status: 400 })
    }

    const bucketId = record.bucket_id
    const filePath = record.name

    // Get public URL of the uploaded image
    const { data: publicUrlData } = supabase.storage
      .from(bucketId)
      .getPublicUrl(filePath)

    const imageUrl = publicUrlData.publicUrl

    // Call OpenAI GPT-4o Vision API
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this image. If it is text-heavy (like a poster or flyer), prioritize optical character recognition (OCR) to transcribe the critical text. Otherwise, describe this image in one concise sentence for a blind user using a screen reader, focusing on the physical action, setting, and demographics. Prefix your final sentence strictly with 'AI Generated:'."
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
        max_tokens: 150
      })
    })

    const aiData = await openaiResponse.json()
    const rawDescription = aiData.choices?.[0]?.message?.content || "AI Generated: Event image."
    
    // Ensure safety prefix
    const finalAltText = rawDescription.startsWith("AI Generated:") 
      ? rawDescription 
      : `AI Generated: ${rawDescription}`

    // Save to 'images_metadata' table
    const { error: dbError } = await supabase
      .from("images_metadata")
      .upsert({
        image_url: imageUrl,
        generated_alt_text: finalAltText
      }, { onConflict: "image_url" })

    if (dbError) {
      throw dbError
    }

    return new Response(JSON.stringify({ success: true, altText: finalAltText }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })

  } catch (err) {
    console.error("Error generating alt text:", err)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    })
  }
})
