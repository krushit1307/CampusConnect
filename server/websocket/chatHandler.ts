// server/websocket/chatHandler.ts

import { WebSocket } from 'ws';

// High-stress keyword dictionary for local zero-leakage scanning
const STRESS_KEYWORDS = ['stressed', 'depressed', 'failing', 'burnout', 'overwhelmed', 'drop out', 'anxious'];

export interface ChatMessagePayload {
    userId: string;
    clubId: string;
    message: string;
}

/**
 * Evaluates chat messages locally for stress indicators and triggers private support if needed.
 */
export function processChatMessage(socket: WebSocket, payload: ChatMessagePayload): void {
    const lowerMessage = payload.message.toLowerCase();
    
    // Check if any high-stress keyword is present in the message
    const isDistressed = STRESS_KEYWORDS.some(keyword => lowerMessage.includes(keyword));

    if (isDistressed) {
        // PRIVACY RULE: Send notification ONLY to the affected user's socket.
        // Do NOT broadcast to the group chat or notify admins.
        const supportPayload = {
            type: 'MENTAL_HEALTH_SUPPORT_TRIGGER',
            message: "Finals got you stressed? The Counseling Center has free walk-in hours today.",
            resourceLink: "/counseling-services",
        };

        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(supportPayload));
        }
    }
}
