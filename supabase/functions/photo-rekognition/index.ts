// Supabase Edge Function: photo-rekognition
// Translates Supabase Storage inserts into AWS Rekognition API calls

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// In a real environment, we'd import the AWS SDK for Deno. 
// For this PR, we mock the AWS SDK abstraction.

console.log("Photo Rekognition Edge Function booting...");

serve(async (req) => {
    try {
        const payload = await req.json();

        // Ensure this is triggered by a new photo upload to the event_photos table
        if (payload.type !== 'INSERT' || payload.table !== 'event_photos') {
            return new Response(JSON.stringify({ error: "Invalid trigger payload" }), { status: 400 });
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') || '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        );

        const photoId = payload.record.id;
        const storageUrl = payload.record.storage_url;

        // AWS Rekognition Mock Integration
        // Real logic: Download image buffer, send to Rekognition SearchFacesByImage against the "CampusCollection"
        console.log(`[AWS Rekognition] Analyzing image: ${storageUrl}`);

        // Simulating AWS Rekognition latency and response format
        await new Promise(r => setTimeout(r, 1200));

        // Mock Response: Discovered 2 faces matching known FaceIds
        const rekognitionResults = [
            {
                FaceId: "face-xyz-123",
                Confidence: 99.8,
                BoundingBox: { Top: 0.2, Left: 0.4, Width: 0.1, Height: 0.15 }
            }
        ];

        if (rekognitionResults.length > 0) {
            // Find the User IDs associated with these FaceIds
            const faceIds = rekognitionResults.map(r => r.FaceId);

            const { data: users, error: userError } = await supabase
                .from('biometric_consent_profiles')
                .select('user_id, aws_rekognition_face_id')
                .in('aws_rekognition_face_id', faceIds)
                .eq('has_consented', true);

            if (userError) throw userError;

            // Generate insertion array for photo_tags
            const tagsToInsert = [];
            for (const result of rekognitionResults) {
                const user = users?.find(u => u.aws_rekognition_face_id === result.FaceId);
                if (user) {
                    tagsToInsert.push({
                        photo_id: photoId,
                        user_id: user.user_id,
                        bounding_box_json: result.BoundingBox,
                        confidence_score: result.Confidence,
                        status: 'PENDING'
                    });
                }
            }

            // Insert discovered tags using Service Role
            if (tagsToInsert.length > 0) {
                const { error: insertError } = await supabase
                    .from('photo_tags')
                    .insert(tagsToInsert);

                if (insertError) throw insertError;

                // Real usage: Insert into notifications table
                // "You were spotted in a new photo..."
            }
        }

        // Mark photo as processed
        await supabase
            .from('event_photos')
            .update({ is_processed_by_ai: true })
            .eq('id', photoId);

        return new Response(JSON.stringify({
            success: true,
            message: "Rekognition processing complete",
            facesFound: rekognitionResults.length
        }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error("Rekognition failure:", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
