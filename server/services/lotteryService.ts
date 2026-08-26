// server/services/lotteryService.ts

import crypto from 'crypto';

export interface Participant {
    userId: string;
    status: 'lottery_pending' | 'reserved' | 'waitlisted' | 'confirmed';
    enteredAt: Date;
}

export interface LotteryResult {
    eventId: string;
    capacity: number;
    winners: string[];
    waitlist: string[];
    executedAt: Date;
}

/**
 * Executes a cryptographically secure unbiased lottery draw for high-demand campus events (#4153).
 */
export function executeEventLottery(
    eventId: string,
    capacity: number,
    participants: Participant[]
): LotteryResult {
    // Filter valid pending participants
    const pendingPool = participants.filter(p => p.status === 'lottery_pending');

    if (pendingPool.length <= capacity) {
        // If demand <= capacity, everyone wins
        return {
            eventId,
            capacity,
            winners: pendingPool.map(p => p.userId),
            waitlist: [],
            executedAt: new Date()
        };
    }

    // Cryptographically secure shuffle (Fisher-Yates with crypto.randomInt)
    const shuffled = [...pendingPool];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const randomIndex = crypto.randomInt(0, i + 1);
        [shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]];
    }

    const winnerEntries = shuffled.slice(0, capacity);
    const waitlistEntries = shuffled.slice(capacity);

    return {
        eventId,
        capacity,
        winners: winnerEntries.map(p => p.userId),
        waitlist: waitlistEntries.map(p => p.userId),
        executedAt: new Date()
    };
}
