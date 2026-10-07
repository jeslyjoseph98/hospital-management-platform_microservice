import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchPendingBatchMock = vi.fn();
const markSentMock = vi.fn();

vi.mock('../src/repositories/outboxRepository', () => ({
  fetchPendingBatch: (...args: unknown[]) => fetchPendingBatchMock(...args),
  markSent: (...args: unknown[]) => markSentMock(...args)
}));

import { runOnce } from '../src/events/outboxPublisher';

function row(id: number, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    event_id: `event-${id}`,
    topic: 'appointment.booked',
    message_key: String(id),
    payload: { appointmentId: id },
    status: 'NEW',
    created_at: new Date().toISOString(),
    sent_at: null,
    ...overrides
  };
}

describe('outboxPublisher.runOnce', () => {
  beforeEach(() => {
    fetchPendingBatchMock.mockReset();
    markSentMock.mockReset();
  });

  it('OB-R1/R2: sends each pending record and marks it SENT on ack', async () => {
    fetchPendingBatchMock.mockResolvedValue([row(1), row(2)]);
    const send = vi.fn().mockResolvedValue(undefined);
    const producer = { send } as unknown as { send: typeof send };

    await runOnce(producer as never);

    expect(send).toHaveBeenCalledTimes(2);
    expect(markSentMock).toHaveBeenCalledWith(1);
    expect(markSentMock).toHaveBeenCalledWith(2);
    expect(fetchPendingBatchMock).toHaveBeenCalledWith(50);
  });

  it('OB-R2: stops the run on the first send failure, leaving later records for the next tick', async () => {
    fetchPendingBatchMock.mockResolvedValue([row(1), row(2), row(3)]);
    const send = vi
      .fn()
      .mockResolvedValueOnce(undefined) // record 1 ok
      .mockRejectedValueOnce(new Error('broker down')); // record 2 fails
    const producer = { send } as unknown as { send: typeof send };

    await runOnce(producer as never);

    expect(markSentMock).toHaveBeenCalledWith(1);
    expect(markSentMock).not.toHaveBeenCalledWith(2);
    expect(markSentMock).not.toHaveBeenCalledWith(3);
    // record 3 never attempted because the run stopped after record 2's failure
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('sends the standard Kafka envelope with eventId/eventType/occurredAt/payload', async () => {
    fetchPendingBatchMock.mockResolvedValue([row(7, { topic: 'appointment.booked', message_key: '7' })]);
    const send = vi.fn().mockResolvedValue(undefined);
    const producer = { send } as unknown as { send: typeof send };

    await runOnce(producer as never);

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'appointment.booked',
        messages: [
          expect.objectContaining({
            key: '7'
          })
        ]
      })
    );
    const call = send.mock.calls[0][0];
    const parsed = JSON.parse(call.messages[0].value);
    expect(parsed).toMatchObject({
      eventId: 'event-7',
      eventType: 'appointment.booked',
      payload: { appointmentId: 7 }
    });
    expect(typeof parsed.occurredAt).toBe('string');
  });

  it('a second concurrent call is skipped while a run is still busy (running flag guard)', async () => {
    fetchPendingBatchMock.mockResolvedValue([row(1)]);

    let resolveSend: (() => void) | undefined;
    let notifySendCalled: (() => void) | undefined;
    const sendCalled = new Promise<void>((resolve) => {
      notifySendCalled = resolve;
    });
    const send = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSend = resolve;
          notifySendCalled?.();
        })
    );
    const producer = { send } as unknown as { send: typeof send };

    const firstRun = runOnce(producer as never);
    // Wait until the first run has actually reached producer.send (i.e. is genuinely busy)
    // before firing the second call, so the guard is exercised deterministically.
    await sendCalled;
    // Second call while first is still in-flight should return immediately without fetching again.
    const secondRun = runOnce(producer as never);

    await secondRun;
    expect(fetchPendingBatchMock).toHaveBeenCalledTimes(1);

    resolveSend?.();
    await firstRun;
  });
});
