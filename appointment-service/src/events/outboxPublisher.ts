import { Producer } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import * as outboxRepository from '../repositories/outboxRepository';

const INTERVAL_MS = 2000;

let running = false;
let timer: ReturnType<typeof setInterval> | null = null;

/**
 * OB-R1/OB-R2/OB-R3: every 2s, picks the oldest 50 NEW outbox records and publishes them to
 * Kafka one at a time, waiting for the broker ack before marking SENT. On failure, stops the
 * run; remaining/failed records are retried on the next tick. A `running` flag skips a tick
 * if the previous run is still busy.
 */
export function startOutboxPublisher(producer: Producer): void {
  if (timer) return;
  timer = setInterval(() => {
    void runOnce(producer);
  }, INTERVAL_MS);
}

export function stopOutboxPublisher(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export async function runOnce(producer: Producer): Promise<void> {
  if (running) return;
  running = true;
  try {
    const batch = await outboxRepository.fetchPendingBatch(50);
    for (const record of batch) {
      const envelope = {
        eventId: record.event_id ?? uuidv4(),
        eventType: record.topic,
        occurredAt: new Date().toISOString(),
        payload: record.payload
      };
      try {
        await producer.send({
          topic: record.topic,
          messages: [
            {
              key: record.message_key,
              value: JSON.stringify(envelope)
            }
          ]
        });
        await outboxRepository.markSent(record.id);
      } catch (err) {
        // Stop this run on first failure; retry next tick (OB-R2).
        break;
      }
    }
  } finally {
    running = false;
  }
}
