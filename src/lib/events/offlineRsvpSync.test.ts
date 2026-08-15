import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getQueuedRsvps, queueRsvpSubmission, removeQueuedRsvp } from './offlineRsvpSync';
import * as idbKeyval from 'idb-keyval';

vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn(),
}));

describe('offlineRsvpSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queues a new RSVP', async () => {
    vi.mocked(idbKeyval.get).mockResolvedValueOnce([]);
    await queueRsvpSubmission({
      eventId: 'evt-1',
      hasRsvpd: false,
      idempotencyKey: 'idemp-1',
      queuedAt: 123
    });

    expect(idbKeyval.set).toHaveBeenCalledWith('rsvp_outbox', [
      {
        eventId: 'evt-1',
        hasRsvpd: false,
        idempotencyKey: 'idemp-1',
        queuedAt: 123
      }
    ]);
  });

  it('replaces duplicate RSVP for same event', async () => {
    vi.mocked(idbKeyval.get).mockResolvedValueOnce([
      {
        eventId: 'evt-1',
        hasRsvpd: false,
        idempotencyKey: 'old-idemp',
        queuedAt: 100
      }
    ]);
    
    await queueRsvpSubmission({
      eventId: 'evt-1',
      hasRsvpd: false,
      idempotencyKey: 'new-idemp',
      queuedAt: 200
    });

    expect(idbKeyval.set).toHaveBeenCalledWith('rsvp_outbox', [
      {
        eventId: 'evt-1',
        hasRsvpd: false,
        idempotencyKey: 'new-idemp',
        queuedAt: 200
      }
    ]);
  });

  it('removes an RSVP by idempotency key', async () => {
    vi.mocked(idbKeyval.get).mockResolvedValueOnce([
      { eventId: 'evt-1', hasRsvpd: false, idempotencyKey: 'key1', queuedAt: 1 },
      { eventId: 'evt-2', hasRsvpd: true, idempotencyKey: 'key2', queuedAt: 2 }
    ]);

    await removeQueuedRsvp('key1');

    expect(idbKeyval.set).toHaveBeenCalledWith('rsvp_outbox', [
      { eventId: 'evt-2', hasRsvpd: true, idempotencyKey: 'key2', queuedAt: 2 }
    ]);
  });
});
