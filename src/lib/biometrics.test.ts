// Tests for AWS Rekognition Webhook Edge Function logic
// And Biometric Hook client logic

import { renderHook, act } from '@testing-library/react-hooks';
import { useBiometrics } from '../hooks/useBiometrics';

// Mocking Edge Function Core Logic
const processPhotoMock = async (photoId: string, storageUrl: string, dbState: any[]) => {
    // Basic AWS Rekognition Simulation

    // Simulate finding one face
    const mockRekognitionResponse = [
        { FaceId: 'face-001', Confidence: 99.9, BoundingBox: { Top: 0.1, Left: 0.1, Width: 0.2, Height: 0.2 } }
    ];

    let dbInserts = 0;
    const tags = [];

    for (const res of mockRekognitionResponse) {
        const matchingUser = dbState.find(user => user.aws_rekognition_face_id === res.FaceId && user.has_consented === true);
        if (matchingUser) {
            tags.push({
                photo_id: photoId,
                user_id: matchingUser.user_id,
                confidence_score: res.Confidence,
                bounding_box_json: res.BoundingBox
            });
            dbInserts++;
        }
    }

    return { success: true, processed: dbInserts, tags };
};

describe('Facial Recognition Engine', () => {

    describe('Edge Function Logic', () => {
        it('ignores faces that do not match any consented profiles in the DB', async () => {
            const mockDb = [
                { user_id: 'userA', aws_rekognition_face_id: 'face-123', has_consented: true },
                { user_id: 'userB', aws_rekognition_face_id: 'face-001', has_consented: false } // Found, but no consent
            ];

            const result = await processPhotoMock('photoX', 'url', mockDb);
            expect(result.processed).toBe(0);
            expect(result.tags.length).toBe(0);
        });

        it('successfully tags a consented user if a match is found', async () => {
            const mockDb = [
                { user_id: 'userC', aws_rekognition_face_id: 'face-001', has_consented: true }
            ];

            const result = await processPhotoMock('photoY', 'url', mockDb);
            expect(result.processed).toBe(1);
            expect(result.tags[0].user_id).toBe('userC');
            expect(result.tags[0].confidence_score).toBeGreaterThan(99);
        });
    });

    describe('Biometrics React Hook', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('hydrates profile safely', async () => {
            const { result, waitForNextUpdate } = renderHook(() => useBiometrics('usr-1'));

            act(() => {
                result.current.fetchProfile();
            });

            expect(result.current.loading).toBe(true);

            act(() => { jest.advanceTimersByTime(500); });
            await waitForNextUpdate();

            expect(result.current.loading).toBe(false);
            expect(result.current.profile).toBeDefined();
            expect(result.current.profile?.user_id).toBe('usr-1');
        });

        it('submits consent and toggles profile state', async () => {
            const { result, waitForNextUpdate } = renderHook(() => useBiometrics('usr-1'));

            act(() => {
                result.current.submitConsent('John Doe Test', new File([], 'selfie.jpg'));
            });

            act(() => { jest.advanceTimersByTime(1600); });
            await waitForNextUpdate();

            expect(result.current.profile?.has_consented).toBe(true);
            expect(result.current.profile?.consent_signature).toBe('John Doe Test');
        });

        it('revokes consent safely', async () => {
            const { result, waitForNextUpdate } = renderHook(() => useBiometrics('usr-1'));

            // First submit it
            act(() => {
                result.current.submitConsent('John', new File([], 'a.jpg'));
            });

            act(() => { jest.advanceTimersByTime(1600); });
            await waitForNextUpdate();

            // Now revoke it
            act(() => {
                result.current.revokeConsent();
            });

            act(() => { jest.advanceTimersByTime(900); });
            await waitForNextUpdate();

            expect(result.current.profile?.has_consented).toBe(false);
            expect(result.current.profile?.revoked_at).toBeDefined();
        });
    });
});
