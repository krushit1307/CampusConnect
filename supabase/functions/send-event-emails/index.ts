import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { event_id } = await req.json();
    if (!event_id) {
      return new Response(JSON.stringify({ error: "event_id is required" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Initialize Supabase Client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Fetch Event Details
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("*, clubs(name)")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), { 
        status: 404, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Fetch member emails using the secure RPC function
    const { data: members, error: membersError } = await supabase
      .rpc("get_event_member_emails", { p_event_id: event_id });

    if (membersError) {
      throw new Error(`Failed to fetch members: ${membersError.message}`);
    }

    if (!members || members.length === 0) {
      return new Response(JSON.stringify({ message: "No members to notify" }), { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const emailList = members.map((m: any) => m.email);

    // Dispatch Emails via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    // We send using bcc to hide emails from other members
    const emailBody = {
      from: "CampusConnect <notifications@campusconnect.app>",
      to: ["notifications@campusconnect.app"], // Dummy to address since BCC is used
      bcc: emailList,
      subject: `New Event from ${event.clubs?.name || 'your club'}: ${event.title}`,
      html: `
        <h2>${event.title}</h2>
        <p><strong>Date:</strong> ${new Date(event.event_date).toLocaleString()}</p>
        <p><strong>Location:</strong> ${event.location || 'TBA'}</p>
        <p>${event.description || "Join us for our upcoming event!"}</p>
      `,
    };

    if (!resendApiKey) {
      console.log("Mocking email dispatch. Would have sent to:", emailList);
      return new Response(JSON.stringify({ message: "Mock emails sent successfully.", count: emailList.length }), { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify(emailBody),
    });

    const resData = await res.json();
    if (!res.ok) {
      throw new Error(`Resend Error: ${JSON.stringify(resData)}`);
    }

    return new Response(JSON.stringify({ message: "Emails dispatched successfully", data: resData, count: emailList.length }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error: any) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
