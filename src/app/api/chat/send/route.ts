import { NextRequest, NextResponse } from 'next/server';
import { checkChatRateLimit } from '@/lib/websocket/rateLimiter';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
    try {
        const { userId, channelId, message } = await req.json();

        if (!userId || !channelId || !message) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Check rate limit
        const rateLimit = await checkChatRateLimit(userId);

        if (!rateLimit.allowed) {
            // Silently drop the message from the main channel, but return a specific payload
            // so the client can display a private system message.
            return NextResponse.json({
                success: false,
                rateLimited: true,
                retryAfterSeconds: rateLimit.retryAfterSeconds,
                systemMessage: `You are sending messages too fast. Please wait ${rateLimit.retryAfterSeconds} seconds.`,
            }, { status: 429 });
        }

        // 2. Save message to database
        const { data, error } = await supabase
            .from('chat_messages')
            .insert({
                user_id: userId,
                channel_id: channelId,
                content: message,
                created_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            throw new Error(error.message);
        }

        // 3. In a real app, broadcast via WebSocket here (e.g., Pusher, Ably, or custom WS server)
        // For this implementation, we return the saved message for the client to optimistically update

        return NextResponse.json({
            success: true,
            message: data,
            remainingTokens: rateLimit.remainingTokens,
        });

    } catch (error) {
        console.error('Chat send error:', error);
        return NextResponse.json(
            { error: 'Failed to send message' },
            { status: 500 }
        );
    }
}
