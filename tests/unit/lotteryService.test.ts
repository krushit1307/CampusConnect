// tests/unit/lotteryService.test.ts

import { executeEventLottery, Participant } from '../../server/services/lotteryService';

describe('Automated Event Waitlist Lottery System (#4153)', () => {

    it('should select exactly N winners matching event capacity', () => {
        const participants: Participant[] = Array.from({ length: 100 }, (_, index) => ({
            userId: `user-${index + 1}`,
            status: 'lottery_pending',
            enteredAt: new Date()
        }));

        const capacity = 10;
        const result = executeEventLottery('event-billionaire-dinner', capacity, participants);

        expect(result.winners.length).toBe(capacity);
        expect(result.waitlist.length).toBe(participants.length - capacity);
    });

    it('should make everyone a winner if total participants are less than or equal to capacity', () => {
        const participants: Participant[] = [
            { userId: 'u1', status: 'lottery_pending', enteredAt: new Date() },
            { userId: 'u2', status: 'lottery_pending', enteredAt: new Date() }
        ];

        const capacity = 5;
        const result = executeEventLottery('event-small', capacity, participants);

        expect(result.winners.length).toBe(2);
        expect(result.waitlist.length).toBe(0);
    });
});
