import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  try {
    const payload = await req.json()
    const record = payload.record
    if (!record || !record.name) {
      return new Response("Invalid storage payload", { status: 400 })
    }

    const filePath = record.name
    // Ensure it's a video file upload
    if (!filePath.match(/\.(mp4|mov|mkv|webm)$/i)) {
      return new Response("Not a video file, skipping.", { status: 200 })
    }

    // Forward task payload to the dedicated processing worker infrastructure (e.g. AWS / Cloud Run)
    const workerWebhookUrl = Deno.env.get("VIDEO_WORKER_WEBHOOK_URL")
    await fetch(workerWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath, bucket: "event_resources" })
    })

    return new Response(JSON.stringify({ success: true, message: "Video processing queued." }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })

  } catch (err) {
    console.error("Webhook Error:", err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
