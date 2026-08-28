import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { evaluateApologySincerity } from '@/lib/ai/apologyEvaluator';
import { ApologySubmission } from '@/types/moderation';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
    try {
        const body: ApologySubmission = await req.json();

        // 1. Validate minimum word count (50 words)
        const wordCount = body.text.trim().split(/\s+/).length;
        if (wordCount < 50) {
            return NextResponse.json(
                { error: `Apology must be at least 50 words. Current count: ${wordCount}` },
                { status: 400 }
            );
        }

        // 2. Evaluate with LLM
        const evaluation = await evaluateApologySincerity(body.text);

        // 3. Save to database
        const { data: apologyRecord, error: insertError } = await supabase
            .from('user_apologies')
            .insert({
                user_id: body.userId,
                violation_id: body.violationId,
                apology_text: body.text,
                llm_evaluation_score: evaluation.score,
                llm_is_sincere: evaluation.isSincere,
                llm_raw_response: evaluation.rawResponse,
                status: evaluation.isSincere ? 'approved' : 'rejected',
            })
            .select()
            .single();

        if (insertError) {
            throw new Error(insertError.message);
        }

        // 4. If sincere, reinstate the user (simplified: update user status)
        if (evaluation.isSincere) {
            await supabase
                .from('users')
                .update({ account_status: 'active', suspension_reason: null })
                .eq('id', body.userId);
        }

        return NextResponse.json({
            success: true,
            isSincere: evaluation.isSincere,
            score: evaluation.score,
            feedback: evaluation.feedback,
            status: apologyRecord.status,
        });
    } catch (error) {
        console.error('Apology evaluation error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to evaluate apology' },
            { status: 500 }
        );
    }
}
